extends Control
## Pulse Lite - main application controller.
## The whole UI is built in code (see _build_* functions) to keep Main.tscn trivial.

const Data = preload("res://scripts/data.gd")
const TB = preload("res://scripts/theme_builder.gd")
const SimScript = preload("res://scripts/sim.gd")
const AvatarScript = preload("res://scripts/avatar.gd")
const TicksScript = preload("res://scripts/ticks.gd")

const SAVE_PATH := "user://pulse_save.json"
const ME_ID := "me"
const MAX_HISTORY := 150
const RENDER_LIMIT := 60
const STATUS_TEXT := ["Sending", "Sent", "Delivered", "Read"]
const STATUS_ORDER := ["online", "idle", "dnd", "offline"]
const STATUS_TITLES := {"online": "ONLINE", "idle": "IDLE", "dnd": "DO NOT DISTURB", "offline": "OFFLINE"}
const HELP_TEXT := "Commands:\n/help - show this list\n/roll [N | XdY] - roll dice, e.g. /roll 20 or /roll 2d6\n/flip - flip a coin\n/poll Question|Option A|Option B - start a poll (up to 6 options)\n/trivia - TriviaBot asks a question; first correct answer wins 50 XP\n/joke - PulseBot tells a joke\n/status online|idle|dnd|offline - set your presence\n/clear - clear this channel locally\nTip: @mention someone (e.g. @Ava) to get their attention."

var avatar_colors: Array = [
	Color("#7c5cff"), Color("#22d3ee"), Color("#f472b6"), Color("#34d399"),
	Color("#f59e0b"), Color("#ef4444"), Color("#60a5fa"), Color("#a3e635"),
]

var sim: SimScript
var rng := RandomNumberGenerator.new()

var profile: Dictionary = {
	"name": "",
	"color": 0,
	"xp": 0,
	"level": 1,
	"streak": 0,
	"last_day": -1,
	"messages_sent": 0,
	"trivia_wins": 0,
	"status": "online",
}

# --- chat state
var messages: Dictionary = {}       # channel key -> Array[Dictionary]
var msg_index: Dictionary = {}      # message id -> Dictionary
var msg_nodes: Dictionary = {}      # message id -> Dictionary of live node refs (current view only)
var unread: Dictionary = {}         # channel key -> int
var typing: Dictionary = {}         # channel key -> Array of user ids
var trivia: Dictionary = {}         # channel key -> active round
var last_channel: Dictionary = {}   # server index -> channel key
var all_channel_keys: Array = []
var next_msg_id: int = 1
var current_server: int = 0
var current_key: String = ""
var typing_phase: int = 0
var channels_open: bool = false
var logged_in: bool = false
var selected_color: int = 0
var stick_bottom: bool = true

# --- UI refs
var bg_layer: Control
var app_root: MarginContainer
var login_layer: CenterContainer
var login_name: LineEdit
var login_preview          # avatar.gd instance
var login_swatches: Array = []
var server_buttons: Array = []
var server_badges: Array = []
var channel_panel: PanelContainer
var server_title: Label
var channel_list: VBoxContainer
var channel_buttons: Dictionary = {}
var channel_badges: Dictionary = {}
var user_avatar            # avatar.gd instance
var user_name_label: Label
var user_level_label: Label
var xp_bar: ProgressBar
var streak_label: Label
var menu_button: Button
var chat_title: Label
var chat_topic: Label
var message_scroll: ScrollContainer
var message_list: VBoxContainer
var typing_label: Label
var composer: LineEdit
var send_button: Button
var member_panel: PanelContainer
var member_title: Label
var member_list: VBoxContainer
var toast_box: VBoxContainer

var ambient_timer: Timer
var presence_timer: Timer
var typing_timer: Timer


# ====================================================================== lifecycle

func _ready() -> void:
	rng.randomize()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = TB.build_theme()
	_load_profile()
	selected_color = clampi(int(profile["color"]), 0, avatar_colors.size() - 1)
	sim = SimScript.new()
	sim.generate(56)
	_build_background()
	_build_app()
	_build_login()
	_build_toast_layer()
	_seed_history()
	_setup_timers()
	get_window().size_changed.connect(_apply_responsive)
	_apply_responsive()


func _later(sec: float, cb: Callable) -> void:
	get_tree().create_timer(sec).timeout.connect(cb)


func _make_timer(sec: float, cb: Callable) -> Timer:
	var t := Timer.new()
	t.wait_time = sec
	t.one_shot = false
	add_child(t)
	t.timeout.connect(cb)
	t.start()
	return t


func _setup_timers() -> void:
	ambient_timer = _make_timer(4.0, _on_ambient_timeout)
	presence_timer = _make_timer(5.0, _on_presence_timeout)
	typing_timer = _make_timer(0.4, _on_typing_tick)


# ====================================================================== persistence

func _load_profile() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return
	var txt := f.get_as_text()
	f.close()
	var data = JSON.parse_string(txt)
	if data is Dictionary:
		for k in data.keys():
			if profile.has(k):
				profile[k] = data[k]
	# JSON numbers come back as floats; normalise types.
	profile["name"] = str(profile["name"])
	profile["color"] = int(profile["color"])
	profile["xp"] = int(profile["xp"])
	profile["level"] = maxi(1, int(profile["level"]))
	profile["streak"] = int(profile["streak"])
	profile["last_day"] = int(profile["last_day"])
	profile["messages_sent"] = int(profile["messages_sent"])
	profile["trivia_wins"] = int(profile["trivia_wins"])
	profile["status"] = str(profile["status"])
	if not STATUS_ORDER.has(profile["status"]):
		profile["status"] = "online"


func _save_profile() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(profile, "\t"))
	f.close()


func _today() -> int:
	var tz: Dictionary = Time.get_time_zone_from_system()
	var bias := int(tz.get("bias", 0))
	var t := Time.get_unix_time_from_system() + bias * 60.0
	return int(floor(t / 86400.0))


## Updates the daily streak. Returns true when this is the first visit today.
func _update_streak() -> bool:
	var today := _today()
	var last := int(profile["last_day"])
	if last == today:
		return false
	if last == today - 1:
		profile["streak"] = int(profile["streak"]) + 1
	else:
		profile["streak"] = 1
	profile["last_day"] = today
	return true


func _clock(offset_sec: float = 0.0) -> String:
	var tz: Dictionary = Time.get_time_zone_from_system()
	var bias := int(tz.get("bias", 0))
	var t := int(Time.get_unix_time_from_system() + bias * 60.0 - offset_sec)
	var d: Dictionary = Time.get_datetime_dict_from_unix_time(t)
	var h := int(d["hour"])
	var mi := int(d["minute"])
	var suffix := "AM"
	if h >= 12:
		suffix = "PM"
	var h12 := h % 12
	if h12 == 0:
		h12 = 12
	return "%d:%02d %s" % [h12, mi, suffix]


# ====================================================================== UI construction

func _build_background() -> void:
	bg_layer = Control.new()
	bg_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg_layer)
	bg_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var base := TextureRect.new()
	base.texture = TB.linear_gradient(TB.BG, TB.BG2)
	base.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	base.stretch_mode = TextureRect.STRETCH_SCALE
	base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg_layer.add_child(base)
	base.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_add_orb(TB.ACCENT, Rect2(-0.15, -0.25, 0.7, 0.9), 4.0)
	_add_orb(TB.CYAN, Rect2(0.55, 0.45, 0.6, 0.8), 5.5)


func _add_orb(col: Color, r: Rect2, period: float) -> void:
	var orb := TextureRect.new()
	orb.texture = TB.radial_glow(col)
	orb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	orb.stretch_mode = TextureRect.STRETCH_SCALE
	orb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg_layer.add_child(orb)
	orb.set_anchor_and_offset(SIDE_LEFT, r.position.x, 0.0, true)
	orb.set_anchor_and_offset(SIDE_TOP, r.position.y, 0.0, true)
	orb.set_anchor_and_offset(SIDE_RIGHT, r.position.x + r.size.x, 0.0, true)
	orb.set_anchor_and_offset(SIDE_BOTTOM, r.position.y + r.size.y, 0.0, true)
	var tw := orb.create_tween().set_loops()
	tw.tween_property(orb, "modulate:a", 0.55, period).set_trans(Tween.TRANS_SINE)
	tw.tween_property(orb, "modulate:a", 1.0, period).set_trans(Tween.TRANS_SINE)


func _build_app() -> void:
	app_root = MarginContainer.new()
	app_root.visible = false
	add_child(app_root)
	app_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		app_root.add_theme_constant_override(side, 10)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	app_root.add_child(row)
	row.add_child(_build_server_rail())
	channel_panel = _build_channel_panel()
	row.add_child(channel_panel)
	row.add_child(_build_chat_panel())
	member_panel = _build_member_panel()
	row.add_child(member_panel)


func _build_server_rail() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(72, 0)
	panel.add_theme_stylebox_override("panel", TB.glass(18, 12.0))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	panel.add_child(v)
	var logo := Label.new()
	logo.text = "PULSE"
	logo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	logo.add_theme_font_size_override("font_size", 11)
	logo.add_theme_color_override("font_color", TB.CYAN)
	v.add_child(logo)
	v.add_child(HSeparator.new())
	for i in range(Data.SERVERS.size()):
		var s: Dictionary = Data.SERVERS[i]
		var b := Button.new()
		b.text = SimScript.initials(str(s["name"]))
		b.tooltip_text = str(s["name"])
		b.custom_minimum_size = Vector2(48, 48)
		b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 16)
		v.add_child(b)
		var badge := _make_badge()
		b.add_child(badge)
		_place_badge(badge, true)
		b.pressed.connect(_on_server_pressed.bind(i))
		b.mouse_entered.connect(_on_hover_pop.bind(b, true))
		b.mouse_exited.connect(_on_hover_pop.bind(b, false))
		server_buttons.append(b)
		server_badges.append(badge)
	_refresh_server_buttons()
	return panel


func _build_channel_panel() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(240, 0)
	panel.add_theme_stylebox_override("panel", TB.glass(18, 12.0))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)
	server_title = Label.new()
	server_title.add_theme_font_size_override("font_size", 18)
	server_title.clip_text = true
	v.add_child(server_title)
	v.add_child(HSeparator.new())
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	channel_list = VBoxContainer.new()
	channel_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	channel_list.add_theme_constant_override("separation", 2)
	scroll.add_child(channel_list)
	v.add_child(_build_user_panel())
	return panel


func _build_user_panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", TB.flat(TB.PANEL_DARK, 14, 10.0, TB.BORDER, 1))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	v.add_child(h)
	user_avatar = AvatarScript.new()
	user_avatar.setup(_my_color(), "?", 38.0, "online")
	h.add_child(user_avatar)
	var nv := VBoxContainer.new()
	nv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nv.add_theme_constant_override("separation", 0)
	h.add_child(nv)
	user_name_label = Label.new()
	user_name_label.clip_text = true
	user_name_label.add_theme_font_size_override("font_size", 15)
	nv.add_child(user_name_label)
	user_level_label = Label.new()
	user_level_label.clip_text = true
	user_level_label.add_theme_font_size_override("font_size", 12)
	user_level_label.add_theme_color_override("font_color", TB.MUTED)
	nv.add_child(user_level_label)
	xp_bar = ProgressBar.new()
	xp_bar.show_percentage = false
	xp_bar.custom_minimum_size = Vector2(0, 8)
	xp_bar.min_value = 0.0
	xp_bar.max_value = 100.0
	v.add_child(xp_bar)
	streak_label = Label.new()
	streak_label.add_theme_font_size_override("font_size", 12)
	streak_label.add_theme_color_override("font_color", TB.GOLD)
	v.add_child(streak_label)
	return p


func _build_chat_panel() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", TB.glass(18, 12.0))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	v.add_child(header)
	menu_button = Button.new()
	menu_button.text = "Channels"
	menu_button.focus_mode = Control.FOCUS_NONE
	menu_button.visible = false
	menu_button.pressed.connect(_on_menu_pressed)
	header.add_child(menu_button)
	chat_title = Label.new()
	chat_title.add_theme_font_size_override("font_size", 18)
	header.add_child(chat_title)
	chat_topic = Label.new()
	chat_topic.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	chat_topic.clip_text = true
	chat_topic.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	chat_topic.add_theme_font_size_override("font_size", 13)
	chat_topic.add_theme_color_override("font_color", TB.MUTED)
	header.add_child(chat_topic)
	v.add_child(HSeparator.new())

	message_scroll = ScrollContainer.new()
	message_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	message_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(message_scroll)
	message_list = VBoxContainer.new()
	message_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	message_list.add_theme_constant_override("separation", 4)
	message_scroll.add_child(message_list)
	var bar := message_scroll.get_v_scroll_bar()
	bar.changed.connect(_on_scroll_changed)
	bar.value_changed.connect(_on_scroll_value_changed)

	typing_label = Label.new()
	typing_label.custom_minimum_size = Vector2(0, 18)
	typing_label.add_theme_font_size_override("font_size", 12)
	typing_label.add_theme_color_override("font_color", TB.CYAN)
	v.add_child(typing_label)

	var comp := HBoxContainer.new()
	comp.add_theme_constant_override("separation", 8)
	v.add_child(comp)
	composer = LineEdit.new()
	composer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	composer.custom_minimum_size = Vector2(0, 44)
	composer.max_length = 400
	composer.placeholder_text = "Message"
	composer.text_submitted.connect(_on_composer_submitted)
	comp.add_child(composer)
	send_button = Button.new()
	send_button.text = "Send"
	send_button.custom_minimum_size = Vector2(84, 44)
	send_button.focus_mode = Control.FOCUS_NONE
	TB.style_button(send_button, TB.ACCENT)
	send_button.pressed.connect(_on_send_pressed)
	comp.add_child(send_button)
	return panel


func _build_member_panel() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(230, 0)
	panel.add_theme_stylebox_override("panel", TB.glass(18, 12.0))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)
	member_title = Label.new()
	member_title.text = "Members"
	member_title.add_theme_font_size_override("font_size", 15)
	v.add_child(member_title)
	v.add_child(HSeparator.new())
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	member_list = VBoxContainer.new()
	member_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	member_list.add_theme_constant_override("separation", 6)
	scroll.add_child(member_list)
	return panel


func _build_login() -> void:
	login_layer = CenterContainer.new()
	add_child(login_layer)
	login_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(420, 0)
	card.add_theme_stylebox_override("panel", TB.glass(24, 28.0, 0.88))
	login_layer.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	card.add_child(v)

	var title := Label.new()
	title.text = "Pulse Lite"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 34)
	v.add_child(title)
	var sub := Label.new()
	sub.text = "The lightweight companion client for Pulse"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_color_override("font_color", TB.MUTED)
	v.add_child(sub)

	login_preview = AvatarScript.new()
	login_preview.setup(avatar_colors[selected_color], _initials_or_q(str(profile["name"])), 76.0, "online")
	login_preview.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(login_preview)

	v.add_child(_section_label("DISPLAY NAME"))
	login_name = LineEdit.new()
	login_name.placeholder_text = "e.g. NovaByte"
	login_name.max_length = 20
	login_name.custom_minimum_size = Vector2(0, 44)
	login_name.text = str(profile["name"])
	login_name.text_changed.connect(_on_login_name_changed)
	login_name.text_submitted.connect(_on_login_submitted)
	v.add_child(login_name)

	v.add_child(_section_label("AVATAR COLOR"))
	var sw := HBoxContainer.new()
	sw.alignment = BoxContainer.ALIGNMENT_CENTER
	sw.add_theme_constant_override("separation", 10)
	v.add_child(sw)
	for i in range(avatar_colors.size()):
		var b := Button.new()
		b.custom_minimum_size = Vector2(34, 34)
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(_on_swatch_pressed.bind(i))
		sw.add_child(b)
		login_swatches.append(b)
	_refresh_swatches()

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 4)
	v.add_child(spacer)
	var enter := Button.new()
	enter.text = "Enter Pulse"
	enter.custom_minimum_size = Vector2(0, 46)
	enter.focus_mode = Control.FOCUS_NONE
	enter.add_theme_font_size_override("font_size", 16)
	TB.style_button(enter, TB.ACCENT)
	enter.pressed.connect(_on_enter_pressed)
	v.add_child(enter)

	var info := Label.new()
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_theme_font_size_override("font_size", 12)
	info.add_theme_color_override("font_color", TB.MUTED)
	if int(profile["streak"]) > 0:
		info.text = "Welcome back! Level %d - streak %d day(s). Saved on this device." % [int(profile["level"]), int(profile["streak"])]
	else:
		info.text = "Your profile, XP and daily streak are saved on this device."
	v.add_child(info)

	card.modulate.a = 0.0
	var tw := card.create_tween()
	tw.tween_property(card, "modulate:a", 1.0, 0.45)
	login_name.call_deferred("grab_focus")


func _build_toast_layer() -> void:
	toast_box = VBoxContainer.new()
	toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast_box.add_theme_constant_override("separation", 8)
	add_child(toast_box)
	toast_box.set_anchor_and_offset(SIDE_LEFT, 1.0, -336.0, true)
	toast_box.set_anchor_and_offset(SIDE_RIGHT, 1.0, -20.0, true)
	toast_box.set_anchor_and_offset(SIDE_TOP, 0.0, 20.0, true)
	toast_box.set_anchor_and_offset(SIDE_BOTTOM, 0.0, 20.0, true)
	toast_box.grow_horizontal = Control.GROW_DIRECTION_BEGIN


# ---------------------------------------------------------------------- small widgets

func _section_label(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", TB.MUTED)
	return l


func _make_tag(text: String, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_theme_font_size_override("font_size", 10)
	l.add_theme_color_override("font_color", Color.WHITE)
	l.add_theme_stylebox_override("normal", TB.tag(Color(col.r, col.g, col.b, 0.45)))
	return l


func _make_badge() -> Label:
	var l := Label.new()
	var sb := TB.flat(TB.DANGER, 9, 0.0)
	sb.content_margin_left = 6.0
	sb.content_margin_right = 6.0
	sb.content_margin_top = 1.0
	sb.content_margin_bottom = 1.0
	l.add_theme_stylebox_override("normal", sb)
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", Color.WHITE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.text = "0"
	l.visible = false
	return l


func _place_badge(badge: Control, top_corner: bool) -> void:
	if top_corner:
		badge.set_anchor_and_offset(SIDE_LEFT, 1.0, -16.0, true)
		badge.set_anchor_and_offset(SIDE_RIGHT, 1.0, 4.0, true)
		badge.set_anchor_and_offset(SIDE_TOP, 0.0, -4.0, true)
		badge.set_anchor_and_offset(SIDE_BOTTOM, 0.0, 14.0, true)
	else:
		badge.set_anchor_and_offset(SIDE_LEFT, 1.0, -34.0, true)
		badge.set_anchor_and_offset(SIDE_RIGHT, 1.0, -8.0, true)
		badge.set_anchor_and_offset(SIDE_TOP, 0.5, -9.0, true)
		badge.set_anchor_and_offset(SIDE_BOTTOM, 0.5, 9.0, true)
	badge.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	badge.grow_vertical = Control.GROW_DIRECTION_BOTH


func _make_avatar(col: Color, initials: String, d: float, st: String = "") -> Control:
	var a = AvatarScript.new()
	a.setup(col, initials, d, st)
	return a


func _initials_or_q(nm: String) -> String:
	if nm.strip_edges() == "":
		return "?"
	return SimScript.initials(nm)


func _my_color() -> Color:
	var idx := clampi(int(profile["color"]), 0, avatar_colors.size() - 1)
	return avatar_colors[idx]


func _short(text: String) -> String:
	if text.length() > 80:
		return text.substr(0, 77) + "..."
	return text


# ====================================================================== login

func _on_login_name_changed(new_text: String) -> void:
	login_preview.setup(avatar_colors[selected_color], _initials_or_q(new_text), 76.0, "online")


func _on_login_submitted(_t: String) -> void:
	_on_enter_pressed()


func _on_swatch_pressed(i: int) -> void:
	selected_color = i
	_refresh_swatches()
	login_preview.setup(avatar_colors[selected_color], _initials_or_q(login_name.text), 76.0, "online")
	var tw: Tween = login_preview.create_tween()
	login_preview.pivot_offset = Vector2(38, 38)
	tw.tween_property(login_preview, "scale", Vector2(1.12, 1.12), 0.08)
	tw.tween_property(login_preview, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _refresh_swatches() -> void:
	for i in range(login_swatches.size()):
		var b: Button = login_swatches[i]
		var c: Color = avatar_colors[i]
		var sb := TB.flat(c, 17, 0.0)
		if i == selected_color:
			sb.border_color = Color.WHITE
			sb.set_border_width_all(3)
		b.add_theme_stylebox_override("normal", sb)
		b.add_theme_stylebox_override("hover", TB.flat(c.lightened(0.2), 17, 0.0))
		b.add_theme_stylebox_override("pressed", sb)
		b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())


func _on_enter_pressed() -> void:
	if logged_in:
		return
	var nm := login_name.text.strip_edges()
	if nm.is_empty():
		nm = "Guest%d" % rng.randi_range(100, 999)
	profile["name"] = nm
	profile["color"] = selected_color
	var new_day := _update_streak()
	_save_profile()
	logged_in = true

	var tw := login_layer.create_tween()
	tw.tween_property(login_layer, "modulate:a", 0.0, 0.3)
	tw.tween_callback(login_layer.hide)
	app_root.visible = true
	app_root.modulate.a = 0.0
	var tw2 := app_root.create_tween()
	tw2.tween_property(app_root, "modulate:a", 1.0, 0.45)

	_refresh_user_panel()
	_refresh_members()
	_select_server(0)
	_post_system(current_key, "Welcome to Pulse, %s! Type /help to see what you can do." % nm)
	if new_day:
		_add_xp(20)
		_toast("Daily streak: %d" % int(profile["streak"]), "+20 XP daily bonus. Come back tomorrow to keep it going!", TB.CYAN)
	else:
		_toast("Welcome back, %s" % nm, "You already claimed today's streak bonus.", TB.CYAN)
	_apply_responsive()
	_later(2.5, _greet_new_user)
	composer.call_deferred("grab_focus")


func _greet_new_user() -> void:
	var key := _key_for(0, "general")
	var uid := sim.random_user_id(false)
	if uid == "":
		return
	var line := "welcome @%s! glad you made it" % str(profile["name"])
	_typing_add(key, uid)
	_later(2.0, _bot_post.bind(key, uid, line))


# ====================================================================== servers & channels

func _key_for(server_idx: int, ch: String) -> String:
	return "srv:%d:%s" % [server_idx, ch]


func _channel_of(key: String) -> String:
	if key.begins_with("srv:"):
		var parts := key.split(":")
		if parts.size() >= 3:
			return parts[2]
	return ""


func _key_label(key: String) -> String:
	if key.begins_with("dm:"):
		return "@" + str(sim.get_user(key.substr(3))["name"])
	return "#" + _channel_of(key)


func _on_server_pressed(i: int) -> void:
	_select_server(i)


func _select_server(i: int) -> void:
	current_server = i
	_build_channel_list()
	_refresh_server_buttons()
	var s: Dictionary = Data.SERVERS[i]
	var chans: Array = s["channels"]
	var key: String = last_channel.get(i, _key_for(i, str(chans[0])))
	_select_channel(key)


func _refresh_server_buttons() -> void:
	for i in range(server_buttons.size()):
		var b: Button = server_buttons[i]
		var s: Dictionary = Data.SERVERS[i]
		var hex: String = s["color"]
		var col := Color(hex)
		var sel := i == current_server
		var normal: StyleBoxFlat
		if sel:
			normal = TB.flat(col, 16, 0.0, Color(1, 1, 1, 0.85), 2)
		else:
			normal = TB.flat(col.darkened(0.45), 24, 0.0)
		b.add_theme_stylebox_override("normal", normal)
		b.add_theme_stylebox_override("hover", TB.flat(col, 16, 0.0))
		b.add_theme_stylebox_override("pressed", TB.flat(col.lightened(0.1), 16, 0.0))
		b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		b.add_theme_color_override("font_color", Color.WHITE)


func _on_hover_pop(c: Control, on: bool) -> void:
	c.pivot_offset = c.size * 0.5
	var target := Vector2.ONE
	if on:
		target = Vector2(1.08, 1.08)
	var tw := c.create_tween()
	tw.tween_property(c, "scale", target, 0.12)


func _build_channel_list() -> void:
	for c in channel_list.get_children():
		channel_list.remove_child(c)
		c.queue_free()
	channel_buttons.clear()
	channel_badges.clear()
	var s: Dictionary = Data.SERVERS[current_server]
	server_title.text = str(s["name"])
	channel_list.add_child(_section_label("TEXT CHANNELS"))
	var chans: Array = s["channels"]
	for ch in chans:
		var ckey := _key_for(current_server, str(ch))
		_add_channel_button(ckey, "#  " + str(ch), {})
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 10)
	channel_list.add_child(spacer)
	channel_list.add_child(_section_label("DIRECT MESSAGES"))
	for b in sim.bots:
		var bd: Dictionary = b
		var dkey := "dm:" + str(bd["id"])
		_add_channel_button(dkey, str(bd["name"]), bd)
	_refresh_channel_selection()
	_refresh_badges()


func _add_channel_button(key: String, label: String, bot: Dictionary) -> void:
	var is_dm := not bot.is_empty()
	var b := Button.new()
	b.text = label
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.focus_mode = Control.FOCUS_NONE
	b.clip_text = true
	b.custom_minimum_size = Vector2(0, 42 if is_dm else 36)
	b.set_meta("pad_left", 46.0 if is_dm else 12.0)
	_style_channel_button(b, false)
	channel_list.add_child(b)
	if is_dm:
		var av := _make_avatar(bot["color"], str(bot["initials"]), 28.0, "online")
		b.add_child(av)
		av.set_anchor_and_offset(SIDE_LEFT, 0.0, 10.0, true)
		av.set_anchor_and_offset(SIDE_RIGHT, 0.0, 38.0, true)
		av.set_anchor_and_offset(SIDE_TOP, 0.5, -14.0, true)
		av.set_anchor_and_offset(SIDE_BOTTOM, 0.5, 14.0, true)
	var badge := _make_badge()
	b.add_child(badge)
	_place_badge(badge, false)
	b.pressed.connect(_on_channel_pressed.bind(key))
	b.mouse_entered.connect(_on_channel_hover.bind(b, true))
	b.mouse_exited.connect(_on_channel_hover.bind(b, false))
	channel_buttons[key] = b
	channel_badges[key] = badge


func _style_channel_button(b: Button, selected: bool) -> void:
	var pad: float = b.get_meta("pad_left", 12.0)
	var normal_bg := Color(0, 0, 0, 0)
	var hover_bg := Color(1, 1, 1, 0.07)
	if selected:
		normal_bg = Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.24)
		hover_bg = Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.32)
	var normal := TB.flat(normal_bg, 10, 6.0)
	normal.content_margin_left = pad
	normal.content_margin_right = 40.0
	var hover := TB.flat(hover_bg, 10, 6.0)
	hover.content_margin_left = pad
	hover.content_margin_right = 40.0
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", normal)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("font_color", Color.WHITE if selected else TB.MUTED)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", Color.WHITE)
	b.set_meta("hover_box", hover)


func _on_channel_hover(b: Button, on: bool) -> void:
	if not is_instance_valid(b) or not b.has_meta("hover_box"):
		return
	var hb: StyleBoxFlat = b.get_meta("hover_box")
	var pad: float = b.get_meta("pad_left", 12.0)
	hb.content_margin_left = pad
	if on:
		var tw := b.create_tween()
		tw.tween_property(hb, "content_margin_left", pad + 6.0, 0.15).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


func _refresh_channel_selection() -> void:
	for k in channel_buttons.keys():
		var b: Button = channel_buttons[k]
		_style_channel_button(b, str(k) == current_key)


func _on_channel_pressed(key: String) -> void:
	_select_channel(key)
	if channels_open:
		channels_open = false
		_apply_responsive()


func _select_channel(key: String) -> void:
	current_key = key
	unread[key] = 0
	if key.begins_with("dm:"):
		var u := sim.get_user(key.substr(3))
		chat_title.text = "@ " + str(u["name"])
		chat_topic.text = str(u.get("bio", ""))
		composer.placeholder_text = "Message @%s" % str(u["name"])
	else:
		last_channel[current_server] = key
		var ch := _channel_of(key)
		chat_title.text = "# " + ch
		chat_topic.text = str(Data.CHANNEL_TOPICS.get(ch, ""))
		composer.placeholder_text = "Message #%s  -  try /help, /trivia or /poll" % ch
	_refresh_channel_selection()
	_refresh_badges()
	_render_all()
	_refresh_typing()
	composer.call_deferred("grab_focus")


func _refresh_badges() -> void:
	for k in channel_badges.keys():
		var l: Label = channel_badges[k]
		var n := int(unread.get(k, 0))
		l.visible = n > 0
		l.text = str(n) if n < 100 else "99+"
	var grand_total := 0
	for i in range(server_badges.size()):
		var bl: Label = server_badges[i]
		var prefix := "srv:%d:" % i
		var total := 0
		for k in unread.keys():
			if str(k).begins_with(prefix):
				total += int(unread[k])
		bl.visible = total > 0 and i != current_server
		bl.text = str(total) if total < 100 else "99+"
	for k in unread.keys():
		grand_total += int(unread[k])
	if grand_total > 0:
		get_window().title = "(%d) Pulse Lite" % grand_total
	else:
		get_window().title = "Pulse Lite"


# ====================================================================== message model

func _new_msg(author: String, text: String, kind: String = "chat") -> Dictionary:
	var m := {
		"id": next_msg_id,
		"author": author,
		"text": text,
		"kind": kind,
		"time": _clock(0.0),
		"status": 0,
		"reactions": {},
		"my_reacts": {},
	}
	next_msg_id += 1
	return m


func _store(key: String, m: Dictionary) -> void:
	if not messages.has(key):
		messages[key] = []
	var arr: Array = messages[key]
	arr.append(m)
	msg_index[int(m["id"])] = m
	while arr.size() > MAX_HISTORY:
		var old: Dictionary = arr.pop_front()
		msg_index.erase(int(old["id"]))
		msg_nodes.erase(int(old["id"]))


func _add_message(key: String, m: Dictionary, animate: bool = true) -> void:
	_store(key, m)
	var kind: String = m["kind"]
	var author: String = m["author"]
	if logged_in and key == current_key:
		_render_message(m, animate)
		while message_list.get_child_count() > RENDER_LIMIT + 20:
			var first := message_list.get_child(0)
			message_list.remove_child(first)
			first.queue_free()
		return
	if kind == "system" or author == ME_ID:
		return
	var n := int(unread.get(key, 0)) + 1
	unread[key] = n
	_refresh_badges()
	if not logged_in:
		return
	var text: String = m["text"]
	var info := _author_info(author)
	if key.begins_with("dm:"):
		_toast("DM from %s" % str(info["name"]), _short(text), TB.CYAN)
	elif _mentions_me(text):
		_toast("%s mentioned you in %s" % [str(info["name"]), _key_label(key)], _short(text), TB.ACCENT)
	elif n == 1 and rng.randf() < 0.25:
		_toast(_key_label(key), "%s: %s" % [str(info["name"]), _short(text)], TB.MUTED)


func _post_system(key: String, text: String) -> void:
	_add_message(key, _new_msg("system", text, "system"))


func _author_info(author_id: String) -> Dictionary:
	if author_id == ME_ID:
		var nm := str(profile["name"])
		return {
			"id": ME_ID,
			"name": nm,
			"color": _my_color(),
			"initials": _initials_or_q(nm),
			"bot": false,
			"persona": "you",
			"activity": "That's you!",
			"status": str(profile["status"]),
		}
	return sim.get_user(author_id)


func _mentions_me(text: String) -> bool:
	var nm := str(profile["name"])
	if nm == "":
		return false
	return text.to_lower().contains("@" + nm.to_lower())


func _seed_history() -> void:
	all_channel_keys.clear()
	for si in range(Data.SERVERS.size()):
		var s: Dictionary = Data.SERVERS[si]
		var chans: Array = s["channels"]
		for ch in chans:
			var ch_name := str(ch)
			var key := _key_for(si, ch_name)
			all_channel_keys.append(key)
			messages[key] = []
			var count := rng.randi_range(4, 8)
			var ago := float(count) * rng.randf_range(5.0, 9.0) * 60.0
			for i in range(count):
				var uid := sim.random_user_id(true)
				var m := _new_msg(uid, sim.ambient_line(uid, ch_name, ""))
				m["time"] = _clock(ago)
				ago = maxf(0.0, ago - rng.randf_range(2.0, 9.0) * 60.0)
				if rng.randf() < 0.3:
					var r: Dictionary = m["reactions"]
					var emo: String = Data.REACTIONS[rng.randi_range(0, Data.REACTIONS.size() - 1)]
					r[emo] = rng.randi_range(1, 6)
				_store(key, m)
	for b in sim.bots:
		var bd: Dictionary = b
		var bid := str(bd["id"])
		var dkey := "dm:" + bid
		messages[dkey] = []
		var dm := _new_msg(bid, str(bd["greeting"]))
		dm["time"] = _clock(3600.0)
		_store(dkey, dm)


# ====================================================================== rendering

func _render_all() -> void:
	for c in message_list.get_children():
		message_list.remove_child(c)
		c.queue_free()
	msg_nodes.clear()
	stick_bottom = true
	var arr: Array = messages.get(current_key, [])
	var start := maxi(0, arr.size() - RENDER_LIMIT)
	if start == 0:
		_render_intro()
	for i in range(start, arr.size()):
		_render_message(arr[i], false)


func _render_intro() -> void:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	var title := Label.new()
	var sub := Label.new()
	if current_key.begins_with("dm:"):
		var u := sim.get_user(current_key.substr(3))
		title.text = str(u["name"])
		sub.text = "This is the beginning of your direct message history with %s." % str(u["name"])
	else:
		title.text = "Welcome to #%s!" % _channel_of(current_key)
		sub.text = "This is the start of the #%s channel. %s" % [_channel_of(current_key), str(Data.CHANNEL_TOPICS.get(_channel_of(current_key), ""))]
	title.add_theme_font_size_override("font_size", 24)
	sub.add_theme_color_override("font_color", TB.MUTED)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(title)
	box.add_child(sub)
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_left", 10)
	m.add_theme_constant_override("margin_top", 12)
	m.add_theme_constant_override("margin_bottom", 10)
	m.add_child(box)
	message_list.add_child(m)


func _render_message(m: Dictionary, animate: bool) -> void:
	var kind: String = m["kind"]
	var row := MarginContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.mouse_filter = Control.MOUSE_FILTER_PASS
	row.add_theme_constant_override("margin_left", 6)
	row.add_theme_constant_override("margin_right", 6)
	row.add_theme_constant_override("margin_top", 1)
	row.add_theme_constant_override("margin_bottom", 1)
	message_list.add_child(row)
	if kind == "system":
		_build_system_row(row, m)
	else:
		_build_chat_row(row, m)
	if animate:
		row.modulate.a = 0.0
		row.add_theme_constant_override("margin_left", 34)
		var tw := row.create_tween().set_parallel(true)
		tw.tween_property(row, "modulate:a", 1.0, 0.28)
		tw.tween_property(row, "theme_override_constants/margin_left", 6, 0.32).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _build_system_row(row: MarginContainer, m: Dictionary) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", TB.flat(Color(1, 1, 1, 0.035), 10, 8.0, TB.BORDER, 1))
	row.add_child(p)
	var l := Label.new()
	var text := str(m["text"])
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if text.contains("\n"):
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	else:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_color", TB.MUTED)
	l.add_theme_font_size_override("font_size", 13)
	p.add_child(l)


func _build_chat_row(row: MarginContainer, m: Dictionary) -> void:
	var author: String = m["author"]
	var info := _author_info(author)
	var mine := author == ME_ID
	var text: String = m["text"]
	var name_col: Color = info["color"]

	var base_bg := Color(1, 1, 1, 0.03)
	var border := Color(0, 0, 0, 0)
	var bw := 0
	if mine:
		base_bg = Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.12)
	elif _mentions_me(text):
		base_bg = Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.18)
		border = TB.ACCENT
		bw = 1
	var sb := TB.flat(base_bg, 14, 10.0, border, bw)
	var bubble := PanelContainer.new()
	bubble.add_theme_stylebox_override("panel", sb)
	bubble.mouse_filter = Control.MOUSE_FILTER_PASS
	bubble.mouse_entered.connect(_on_bubble_hover.bind(sb, base_bg, true))
	bubble.mouse_exited.connect(_on_bubble_hover.bind(sb, base_bg, false))
	row.add_child(bubble)

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	bubble.add_child(h)
	h.add_child(_make_avatar(name_col, str(info["initials"]), 40.0, ""))
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 3)
	h.add_child(v)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	v.add_child(head)
	var nl := Label.new()
	nl.text = str(info["name"])
	nl.add_theme_color_override("font_color", name_col.lightened(0.3))
	nl.add_theme_font_size_override("font_size", 15)
	head.add_child(nl)
	if bool(info.get("bot", false)):
		head.add_child(_make_tag("BOT", TB.ACCENT))
	elif mine:
		head.add_child(_make_tag("YOU", TB.CYAN))
	var tl := Label.new()
	tl.text = str(m["time"])
	tl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tl.add_theme_color_override("font_color", TB.MUTED)
	tl.add_theme_font_size_override("font_size", 12)
	head.add_child(tl)

	var body := Label.new()
	body.text = text
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(body)

	var refs: Dictionary = {}
	if str(m["kind"]) == "poll":
		refs["poll"] = _build_poll_box(v, m)
	var reacts := HBoxContainer.new()
	reacts.add_theme_constant_override("separation", 4)
	v.add_child(reacts)
	refs["reactions"] = reacts
	_fill_reactions(reacts, m)

	if mine:
		var sr := HBoxContainer.new()
		sr.alignment = BoxContainer.ALIGNMENT_END
		sr.add_theme_constant_override("separation", 4)
		v.add_child(sr)
		var st := int(m["status"])
		var ticks = TicksScript.new()
		ticks.set_state(st)
		ticks.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		sr.add_child(ticks)
		var sl := Label.new()
		sl.text = STATUS_TEXT[st]
		sl.add_theme_font_size_override("font_size", 11)
		sl.add_theme_color_override("font_color", TB.CYAN if st >= 3 else TB.MUTED)
		sr.add_child(sl)
		refs["ticks"] = ticks
		refs["status_label"] = sl
	msg_nodes[int(m["id"])] = refs


func _on_bubble_hover(sb: StyleBoxFlat, base: Color, on: bool) -> void:
	var target := base
	if on:
		target = Color(base.r, base.g, base.b, minf(1.0, base.a + 0.05))
	var tw := create_tween()
	tw.tween_property(sb, "bg_color", target, 0.12)


func _on_scroll_changed() -> void:
	if stick_bottom:
		var bar := message_scroll.get_v_scroll_bar()
		message_scroll.scroll_vertical = int(bar.max_value)


func _on_scroll_value_changed(_v: float) -> void:
	stick_bottom = _is_near_bottom()


func _is_near_bottom() -> bool:
	var bar := message_scroll.get_v_scroll_bar()
	return bar.value + bar.page >= bar.max_value - 48.0


# ---------------------------------------------------------------------- reactions

func _fill_reactions(box: HBoxContainer, m: Dictionary) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()
	var r: Dictionary = m["reactions"]
	var mine: Dictionary = m["my_reacts"]
	box.visible = not r.is_empty()
	for k in r.keys():
		var emo := str(k)
		var b := Button.new()
		b.text = "%s  %d" % [emo, int(r[k])]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 12)
		var on := mine.has(emo)
		var bg := Color(1, 1, 1, 0.06)
		var bc := TB.BORDER
		if on:
			bg = Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.28)
			bc = TB.ACCENT
		b.add_theme_stylebox_override("normal", TB.pill(bg, bc))
		b.add_theme_stylebox_override("hover", TB.pill(Color(bg.r, bg.g, bg.b, bg.a + 0.08), TB.CYAN))
		b.add_theme_stylebox_override("pressed", TB.pill(bg, TB.ACCENT))
		b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		b.pressed.connect(_on_reaction_pressed.bind(int(m["id"]), emo))
		box.add_child(b)


func _refresh_reactions(msg_id: int, pop: bool = false) -> void:
	if not msg_nodes.has(msg_id) or not msg_index.has(msg_id):
		return
	var refs: Dictionary = msg_nodes[msg_id]
	var box = refs.get("reactions")
	if not is_instance_valid(box):
		return
	_fill_reactions(box, msg_index[msg_id])
	if pop:
		box.modulate = Color(1.6, 1.6, 1.6, 1.0)
		var tw := create_tween()
		tw.tween_property(box, "modulate", Color.WHITE, 0.4)


func _on_reaction_pressed(msg_id: int, emo: String) -> void:
	if not msg_index.has(msg_id):
		return
	var m: Dictionary = msg_index[msg_id]
	var r: Dictionary = m["reactions"]
	var mine: Dictionary = m["my_reacts"]
	if mine.has(emo):
		mine.erase(emo)
		r[emo] = int(r.get(emo, 1)) - 1
		if int(r[emo]) <= 0:
			r.erase(emo)
	else:
		mine[emo] = true
		r[emo] = int(r.get(emo, 0)) + 1
		_add_xp(1)
	_refresh_reactions(msg_id)


func _bot_react(msg_id: int) -> void:
	if not msg_index.has(msg_id):
		return
	var m: Dictionary = msg_index[msg_id]
	var r: Dictionary = m["reactions"]
	var emo: String = Data.REACTIONS[rng.randi_range(0, Data.REACTIONS.size() - 1)]
	if not r.is_empty() and rng.randf() < 0.5:
		emo = str(r.keys()[rng.randi_range(0, r.size() - 1)])
	r[emo] = int(r.get(emo, 0)) + 1
	_refresh_reactions(msg_id, true)


func _react_random_recent() -> void:
	var arr: Array = messages.get(current_key, [])
	if arr.is_empty():
		return
	var lo := maxi(0, arr.size() - 8)
	var m: Dictionary = arr[rng.randi_range(lo, arr.size() - 1)]
	if str(m["kind"]) == "system":
		return
	_bot_react(int(m["id"]))


# ---------------------------------------------------------------------- message status

func _set_msg_status(msg_id: int, st: int) -> void:
	if not msg_index.has(msg_id):
		return
	var m: Dictionary = msg_index[msg_id]
	if int(m["status"]) >= st:
		return
	m["status"] = st
	if not msg_nodes.has(msg_id):
		return
	var refs: Dictionary = msg_nodes[msg_id]
	var t = refs.get("ticks")
	if is_instance_valid(t):
		t.set_state(st)
	var l = refs.get("status_label")
	if is_instance_valid(l):
		l.text = STATUS_TEXT[st]
		l.add_theme_color_override("font_color", TB.CYAN if st >= 3 else TB.MUTED)


# ====================================================================== composer & commands

func _on_composer_submitted(_t: String) -> void:
	_send_from_composer()


func _on_send_pressed() -> void:
	_send_from_composer()


func _send_from_composer() -> void:
	var t := composer.text.strip_edges()
	composer.clear()
	composer.call_deferred("grab_focus")
	if t.is_empty():
		return
	if t.begins_with("/"):
		_run_command(t)
	else:
		_send_user_message(t)


func _send_user_message(text: String) -> void:
	var key := current_key
	var m := _new_msg(ME_ID, text)
	m["status"] = 1
	stick_bottom = true
	_add_message(key, m)
	var id := int(m["id"])
	_later(rng.randf_range(0.5, 1.1), _set_msg_status.bind(id, 2))
	profile["messages_sent"] = int(profile["messages_sent"]) + 1
	_add_xp(rng.randi_range(4, 9))
	if trivia.has(key) and _check_trivia(key, text, ME_ID):
		_later(rng.randf_range(1.0, 2.0), _set_msg_status.bind(id, 3))
		return
	_schedule_replies(key, text, id)


func _schedule_replies(key: String, text: String, msg_id: int) -> void:
	var intent := sim.detect_intent(text)
	var responders: Array = []
	if key.begins_with("dm:"):
		var bot_id := key.substr(3)
		if bot_id == "bot_trivia" and not trivia.has(key) and _wants_trivia(text):
			_later(1.0, _set_msg_status.bind(msg_id, 3))
			_later(1.6, _start_trivia.bind(key))
			return
		responders.append(bot_id)
	else:
		var mentioned := sim.find_mentioned(text)
		if mentioned != "":
			responders.append(mentioned)
		var roll := rng.randf()
		var extra := 1
		if roll < 0.25:
			extra = 2
		elif roll < 0.4 and not responders.is_empty():
			extra = 0
		var picked: Array = sim.pick_responders(intent, extra, responders)
		for uid in picked:
			responders.append(uid)
	if responders.is_empty():
		_later(rng.randf_range(2.0, 3.5), _set_msg_status.bind(msg_id, 3))
	var delay := rng.randf_range(0.9, 1.8)
	for uid in responders:
		_later(delay, _bot_begin_reply.bind(key, str(uid), text, intent, msg_id))
		delay += rng.randf_range(2.2, 4.2)
	if rng.randf() < 0.45:
		_later(rng.randf_range(1.5, 6.0), _bot_react.bind(msg_id))


func _bot_begin_reply(key: String, uid: String, text: String, intent: String, msg_id: int) -> void:
	_set_msg_status(msg_id, 3)
	_typing_add(key, uid)
	var reply := sim.reply_for(uid, text, intent, str(profile["name"]))
	var dur := clampf(0.9 + reply.length() * 0.035, 1.2, 3.8)
	_later(dur, _bot_post.bind(key, uid, reply))


func _bot_post(key: String, uid: String, text: String) -> void:
	_typing_remove(key, uid)
	_add_message(key, _new_msg(uid, text))


func _run_command(raw: String) -> void:
	var body := raw.substr(1).strip_edges()
	var sp := body.find(" ")
	var cmd := body
	var arg := ""
	if sp >= 0:
		cmd = body.substr(0, sp)
		arg = body.substr(sp + 1).strip_edges()
	cmd = cmd.to_lower()
	match cmd:
		"help", "commands", "?":
			_post_system(current_key, HELP_TEXT)
		"roll", "dice":
			_cmd_roll(arg)
		"flip", "coin":
			_cmd_flip()
		"poll":
			_cmd_poll(arg)
		"trivia", "quiz":
			_start_trivia(current_key)
		"joke":
			var joke: String = Data.JOKES[rng.randi_range(0, Data.JOKES.size() - 1)]
			_typing_add(current_key, "bot_pulse")
			_later(1.2, _bot_post.bind(current_key, "bot_pulse", joke))
		"status":
			_cmd_status(arg)
		"clear":
			messages[current_key] = []
			_render_all()
			_post_system(current_key, "Cleared this channel's history (locally).")
		_:
			_post_system(current_key, "Unknown command \"/%s\". Type /help for the list." % cmd)


func _cmd_roll(arg: String) -> void:
	var count := 1
	var sides := 6
	var a := arg.strip_edges().to_lower()
	if a.contains("d"):
		var p := a.split("d")
		if p.size() >= 2:
			count = clampi(p[0].to_int() if p[0] != "" else 1, 1, 20)
			sides = clampi(p[1].to_int(), 2, 1000)
	elif a.is_valid_int():
		sides = clampi(a.to_int(), 2, 1000)
	var rolls: Array = []
	var total := 0
	for i in range(count):
		var r := rng.randi_range(1, sides)
		rolls.append(r)
		total += r
	var who := str(profile["name"])
	if count == 1:
		_post_system(current_key, "%s rolled a d%d and got %d" % [who, sides, total])
	else:
		_post_system(current_key, "%s rolled %dd%d: %s = %d" % [who, count, sides, str(rolls), total])
	_add_xp(2)


func _cmd_flip() -> void:
	var side := "HEADS" if rng.randf() < 0.5 else "TAILS"
	_post_system(current_key, "%s flipped a coin: %s" % [str(profile["name"]), side])
	_add_xp(2)


func _cmd_poll(arg: String) -> void:
	var parts := arg.split("|")
	var clean: Array = []
	for p in parts:
		var s := str(p).strip_edges()
		if s != "":
			clean.append(s)
	if clean.size() < 3:
		_post_system(current_key, "Usage: /poll Question|Option A|Option B  (up to 6 options)")
		return
	var q: String = clean[0]
	var opts: Array = clean.slice(1, 7)
	var m := _new_msg(ME_ID, "POLL: " + q, "poll")
	m["options"] = opts
	var votes: Array = []
	for i in range(opts.size()):
		votes.append(0)
	m["votes"] = votes
	m["voted"] = -1
	m["status"] = 1
	stick_bottom = true
	_add_message(current_key, m)
	var id := int(m["id"])
	_later(0.8, _set_msg_status.bind(id, 2))
	_later(2.5, _set_msg_status.bind(id, 3))
	var voters := 1
	if current_key.begins_with("srv:"):
		voters = rng.randi_range(4, 10)
	for i in range(voters):
		_later(rng.randf_range(1.5, 18.0), _bot_vote.bind(id))
	_add_xp(5)


func _build_poll_box(parent: VBoxContainer, m: Dictionary) -> Array:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	parent.add_child(box)
	var buttons: Array = []
	var opts: Array = m["options"]
	for i in range(opts.size()):
		var b := Button.new()
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(0, 34)
		b.pressed.connect(_on_poll_vote.bind(int(m["id"]), i))
		box.add_child(b)
		buttons.append(b)
	_update_poll_buttons(buttons, m)
	return buttons


func _update_poll_buttons(buttons: Array, m: Dictionary) -> void:
	var opts: Array = m["options"]
	var votes: Array = m["votes"]
	var voted := int(m["voted"])
	var total := 0
	for x in votes:
		total += int(x)
	for i in range(buttons.size()):
		var obj = buttons[i]
		if not is_instance_valid(obj):
			continue
		var b: Button = obj
		var c := int(votes[i])
		var pct := 0
		if total > 0:
			pct = int(round(100.0 * float(c) / float(total)))
		var marker := "(x) " if i == voted else "( ) "
		b.text = "%s%s   -   %d%%  (%d)" % [marker, str(opts[i]), pct, c]
		var fill := TB.flat(Color(1, 1, 1, 0.05), 10, 10.0, TB.BORDER, 1)
		if i == voted:
			fill = TB.flat(Color(TB.ACCENT.r, TB.ACCENT.g, TB.ACCENT.b, 0.3), 10, 10.0, TB.ACCENT, 1)
		fill.content_margin_top = 4.0
		fill.content_margin_bottom = 4.0
		var hov := TB.flat(Color(1, 1, 1, 0.1), 10, 10.0, TB.CYAN, 1)
		hov.content_margin_top = 4.0
		hov.content_margin_bottom = 4.0
		b.add_theme_stylebox_override("normal", fill)
		b.add_theme_stylebox_override("hover", hov)
		b.add_theme_stylebox_override("pressed", fill)
		b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())


func _refresh_poll(msg_id: int) -> void:
	if not msg_nodes.has(msg_id) or not msg_index.has(msg_id):
		return
	var refs: Dictionary = msg_nodes[msg_id]
	if refs.has("poll"):
		var buttons: Array = refs["poll"]
		_update_poll_buttons(buttons, msg_index[msg_id])


func _on_poll_vote(msg_id: int, idx: int) -> void:
	if not msg_index.has(msg_id):
		return
	var m: Dictionary = msg_index[msg_id]
	var votes: Array = m["votes"]
	var prev := int(m["voted"])
	if prev == idx:
		return
	if prev >= 0:
		votes[prev] = maxi(0, int(votes[prev]) - 1)
	else:
		_add_xp(3)
	votes[idx] = int(votes[idx]) + 1
	m["voted"] = idx
	_refresh_poll(msg_id)


func _bot_vote(msg_id: int) -> void:
	if not msg_index.has(msg_id):
		return
	var m: Dictionary = msg_index[msg_id]
	var votes: Array = m["votes"]
	if votes.is_empty():
		return
	var i := rng.randi_range(0, votes.size() - 1)
	votes[i] = int(votes[i]) + 1
	_refresh_poll(msg_id)


func _cmd_status(arg: String) -> void:
	var a := arg.strip_edges().to_lower()
	if a == "away":
		a = "idle"
	elif a == "busy":
		a = "dnd"
	elif a == "invisible":
		a = "offline"
	if not STATUS_ORDER.has(a):
		_post_system(current_key, "Usage: /status online | idle | dnd | offline")
		return
	profile["status"] = a
	_save_profile()
	_refresh_user_panel()
	_refresh_members()
	_post_system(current_key, "Your status is now %s." % a)


# ---------------------------------------------------------------------- trivia

func _wants_trivia(text: String) -> bool:
	var low := text.to_lower()
	for w in ["trivia", "play", "quiz", "yes", "sure", "go", "question", "ready"]:
		if low.contains(str(w)):
			return true
	return false


func _start_trivia(key: String) -> void:
	if trivia.has(key):
		_post_system(key, "A trivia round is already running here!")
		return
	var q: Dictionary = Data.TRIVIA[rng.randi_range(0, Data.TRIVIA.size() - 1)]
	var token := rng.randi_range(1, 1000000000)
	trivia[key] = {"q": str(q["q"]), "answers": q["a"], "display": str(q["d"]), "token": token}
	_add_message(key, _new_msg("bot_trivia", "TRIVIA TIME! %s\n(First correct answer wins +50 XP - you have 30 seconds.)" % str(q["q"])))
	if key.begins_with("srv:"):
		for i in range(rng.randi_range(1, 3)):
			_later(rng.randf_range(9.0, 27.0), _bot_trivia_guess.bind(key, token))
	_later(30.0, _trivia_timeout.bind(key, token))


func _check_trivia(key: String, text: String, uid: String) -> bool:
	if not trivia.has(key):
		return false
	var t: Dictionary = trivia[key]
	var answers: Array = t["answers"]
	if sim.matches_answer(text, answers):
		_trivia_win(key, uid)
		return true
	return false


func _trivia_win(key: String, uid: String) -> void:
	var t: Dictionary = trivia[key]
	trivia.erase(key)
	var shown := str(t["display"])
	var info := _author_info(uid)
	if uid == ME_ID:
		profile["trivia_wins"] = int(profile["trivia_wins"]) + 1
		_later(0.6, _bot_post.bind(key, "bot_trivia", "Correct, %s! The answer was \"%s\". +50 XP" % [str(info["name"]), shown]))
		_add_xp(50)
		_toast("Trivia win!", "+50 XP. Big brain energy.", TB.CYAN)
	else:
		_later(0.6, _bot_post.bind(key, "bot_trivia", "%s got it first! The answer was \"%s\"." % [str(info["name"]), shown]))


func _bot_trivia_guess(key: String, token: int) -> void:
	if not trivia.has(key):
		return
	var t: Dictionary = trivia[key]
	if int(t["token"]) != token:
		return
	var uid := sim.random_user_id(false)
	if uid == "":
		return
	var answers: Array = t["answers"]
	var guess := ""
	if rng.randf() < 0.4:
		guess = str(answers[0])
	else:
		guess = sim.wrong_guess(answers)
	_typing_add(key, uid)
	_later(rng.randf_range(1.0, 2.0), _bot_trivia_answer.bind(key, token, uid, guess))


func _bot_trivia_answer(key: String, token: int, uid: String, guess: String) -> void:
	_typing_remove(key, uid)
	if not trivia.has(key):
		return
	var t: Dictionary = trivia[key]
	if int(t["token"]) != token:
		return
	_add_message(key, _new_msg(uid, guess))
	_check_trivia(key, guess, uid)


func _trivia_timeout(key: String, token: int) -> void:
	if not trivia.has(key):
		return
	var t: Dictionary = trivia[key]
	if int(t["token"]) != token:
		return
	trivia.erase(key)
	_add_message(key, _new_msg("bot_trivia", "Time's up! The answer was \"%s\". Type /trivia for another round." % str(t["display"])))


# ====================================================================== typing indicator

func _typing_add(key: String, uid: String) -> void:
	var arr: Array = typing.get(key, [])
	if not arr.has(uid):
		arr.append(uid)
	typing[key] = arr
	if key == current_key:
		_refresh_typing()


func _typing_remove(key: String, uid: String) -> void:
	if not typing.has(key):
		return
	var arr: Array = typing[key]
	arr.erase(uid)
	if key == current_key:
		_refresh_typing()


func _on_typing_tick() -> void:
	typing_phase += 1
	_refresh_typing()


func _refresh_typing() -> void:
	if typing_label == null:
		return
	var arr: Array = typing.get(current_key, [])
	if arr.is_empty():
		typing_label.text = ""
		return
	var names: Array = []
	for uid in arr:
		names.append(str(sim.get_user(str(uid))["name"]))
	var dots := ".".repeat(typing_phase % 3 + 1)
	var s := ""
	if names.size() == 1:
		s = "%s is typing" % str(names[0])
	elif names.size() == 2:
		s = "%s and %s are typing" % [str(names[0]), str(names[1])]
	else:
		s = "Several people are typing"
	typing_label.text = s + dots


# ====================================================================== simulation ticks

func _on_ambient_timeout() -> void:
	ambient_timer.wait_time = rng.randf_range(2.8, 6.5)
	ambient_timer.start()
	if not logged_in or all_channel_keys.is_empty():
		return
	var key := ""
	if current_key.begins_with("srv:") and rng.randf() < 0.45:
		key = current_key
	else:
		key = str(all_channel_keys[rng.randi_range(0, all_channel_keys.size() - 1)])
	var uid := sim.random_user_id(false)
	if uid != "":
		var line := sim.ambient_line(uid, _channel_of(key), str(profile["name"]))
		if key == current_key:
			_typing_add(key, uid)
			_later(rng.randf_range(1.2, 3.0), _bot_post.bind(key, uid, line))
		else:
			_add_message(key, _new_msg(uid, line))
	if rng.randf() < 0.35:
		_react_random_recent()
	if rng.randf() < 0.03:
		_bot_dm()


func _bot_dm() -> void:
	if sim.bots.is_empty():
		return
	var b: Dictionary = sim.bots[rng.randi_range(0, sim.bots.size() - 1)]
	var bid := str(b["id"])
	var key := "dm:" + bid
	if key == current_key:
		return
	_add_message(key, _new_msg(bid, sim.bot_ping(bid)))


func _on_presence_timeout() -> void:
	presence_timer.wait_time = rng.randf_range(4.0, 8.0)
	var changed: Array = sim.tick_presence(rng.randi_range(1, 4))
	if not changed.is_empty() and logged_in:
		_refresh_members()


# ====================================================================== members

func _sort_by_name(a: Dictionary, b: Dictionary) -> bool:
	return str(a["name"]).to_lower() < str(b["name"]).to_lower()


func _refresh_members() -> void:
	if member_list == null:
		return
	for c in member_list.get_children():
		member_list.remove_child(c)
		c.queue_free()
	var groups := {"online": [], "idle": [], "dnd": [], "offline": []}
	for u in sim.users:
		var st: String = u["status"]
		var g: Array = groups[st]
		g.append(u)
	var total_online := 0
	member_list.add_child(_section_label("BOTS - %d" % sim.bots.size()))
	for b in sim.bots:
		member_list.add_child(_member_row(b))
	var me := _author_info(ME_ID)
	var my_status := str(profile["status"])
	for st in STATUS_ORDER:
		var arr: Array = groups[st]
		arr.sort_custom(_sort_by_name)
		if st == my_status:
			arr.push_front(me)
		if arr.is_empty():
			continue
		if st != "offline":
			total_online += arr.size()
		member_list.add_child(_section_label("%s - %d" % [str(STATUS_TITLES[st]), arr.size()]))
		for u in arr:
			member_list.add_child(_member_row(u))
	member_title.text = "Members  -  %d online" % total_online


func _member_row(u: Dictionary) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var st: String = u["status"]
	h.add_child(_make_avatar(u["color"], str(u["initials"]), 32.0, st))
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 0)
	h.add_child(v)
	var nl := Label.new()
	nl.text = str(u["name"])
	nl.clip_text = true
	nl.add_theme_font_size_override("font_size", 14)
	var col: Color = u["color"]
	nl.add_theme_color_override("font_color", col.lightened(0.35))
	v.add_child(nl)
	var sub := Label.new()
	var sub_text := ""
	if bool(u.get("bot", false)):
		sub_text = "BOT"
	elif str(u["id"]) == ME_ID:
		sub_text = "That's you!"
	elif st == "offline":
		sub_text = sim.persona_label(str(u.get("persona", "")))
	else:
		sub_text = str(u.get("activity", ""))
		if sub_text == "":
			sub_text = sim.persona_label(str(u.get("persona", "")))
	sub.text = sub_text
	sub.clip_text = true
	sub.add_theme_font_size_override("font_size", 11)
	sub.add_theme_color_override("font_color", TB.MUTED)
	v.add_child(sub)
	if st == "offline":
		h.modulate.a = 0.45
	h.tooltip_text = "%s - %s" % [str(u["name"]), sim.persona_label(str(u.get("persona", "")))]
	h.mouse_filter = Control.MOUSE_FILTER_PASS
	return h


# ====================================================================== XP, levels, user panel

func _xp_needed(level: int) -> int:
	return 100 + (level - 1) * 60


func _add_xp(n: int) -> void:
	var xp := int(profile["xp"]) + n
	var lvl := int(profile["level"])
	var leveled := false
	while xp >= _xp_needed(lvl):
		xp -= _xp_needed(lvl)
		lvl += 1
		leveled = true
	profile["xp"] = xp
	profile["level"] = lvl
	_refresh_user_panel(true)
	if leveled:
		_level_up(lvl)
	_save_profile()


func _refresh_user_panel(animate: bool = false) -> void:
	if user_name_label == null:
		return
	var nm := str(profile["name"])
	user_name_label.text = nm
	user_avatar.setup(_my_color(), _initials_or_q(nm), 38.0, str(profile["status"]))
	var lvl := int(profile["level"])
	var xp := int(profile["xp"])
	var need := _xp_needed(lvl)
	user_level_label.text = "Level %d  -  %d / %d XP" % [lvl, xp, need]
	xp_bar.max_value = float(need)
	if animate:
		var tw := xp_bar.create_tween()
		tw.tween_property(xp_bar, "value", float(xp), 0.35).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	else:
		xp_bar.value = float(xp)
	var streak := int(profile["streak"])
	streak_label.text = "Daily streak: %d day%s" % [streak, "" if streak == 1 else "s"]


func _level_up(lvl: int) -> void:
	_toast("LEVEL UP!", "You reached level %d. Keep chatting!" % lvl, TB.ACCENT, true)
	_post_system(current_key, "%s reached level %d!" % [str(profile["name"]), lvl])
	var tw := user_level_label.create_tween()
	tw.tween_property(user_level_label, "modulate", Color(0.6, 1.0, 1.0), 0.2)
	tw.tween_property(user_level_label, "modulate", Color.WHITE, 0.6)


# ====================================================================== toasts

func _toast(title: String, body: String, accent: Color = Color(0.486, 0.361, 1.0), big: bool = false) -> void:
	if toast_box == null:
		return
	while toast_box.get_child_count() >= 4:
		var oldest := toast_box.get_child(0)
		toast_box.remove_child(oldest)
		oldest.queue_free()
	var holder := MarginContainer.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_theme_constant_override("margin_left", 60)
	toast_box.add_child(holder)

	var p := PanelContainer.new()
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := Color(0.07, 0.07, 0.11, 0.94)
	if big:
		bg = Color(accent.r * 0.35, accent.g * 0.35, accent.b * 0.35, 0.96)
	var sb := TB.flat(bg, 14, 12.0, Color(accent.r, accent.g, accent.b, 0.7), 1)
	sb.border_width_left = 4
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 14
	p.add_theme_stylebox_override("panel", sb)
	holder.add_child(p)

	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	var tl := Label.new()
	tl.text = title
	tl.add_theme_font_size_override("font_size", 20 if big else 14)
	tl.add_theme_color_override("font_color", accent.lightened(0.35))
	v.add_child(tl)
	var bl := Label.new()
	bl.text = body
	bl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bl.add_theme_font_size_override("font_size", 13)
	v.add_child(bl)

	holder.modulate.a = 0.0
	var tw := holder.create_tween()
	tw.set_parallel(true)
	tw.tween_property(holder, "modulate:a", 1.0, 0.25)
	tw.tween_property(holder, "theme_override_constants/margin_left", 0, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if big:
		p.resized.connect(_center_pivot.bind(p))
		p.scale = Vector2(0.7, 0.7)
		tw.tween_property(p, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.chain().tween_interval(4.0 if big else 3.0)
	tw.chain().tween_property(holder, "modulate:a", 0.0, 0.4)
	tw.chain().tween_callback(holder.queue_free)


func _center_pivot(c: Control) -> void:
	c.pivot_offset = c.size * 0.5


# ====================================================================== responsive layout

func _apply_responsive() -> void:
	if member_panel == null or channel_panel == null:
		return
	var scale_f := maxf(DisplayServer.screen_get_scale(), 1.0)
	var w := float(get_window().size.x) / scale_f
	var narrow := w < 700.0
	member_panel.visible = w >= 1000.0
	menu_button.visible = narrow
	if narrow:
		channel_panel.visible = channels_open
	else:
		channels_open = false
		channel_panel.visible = true
	menu_button.text = "Close" if channels_open else "Channels"


func _on_menu_pressed() -> void:
	channels_open = not channels_open
	_apply_responsive()
