extends RefCounted
## StyleBox / Theme helpers for Pulse Lite's dark, glassy look.
## Everything is static so it can be used via preload() without instancing.

const ACCENT := Color(0.486, 0.361, 1.0)
const CYAN := Color(0.133, 0.827, 0.933)
const BG := Color(0.035, 0.035, 0.06)
const BG2 := Color(0.08, 0.05, 0.16)
const PANEL := Color(0.075, 0.075, 0.12)
const PANEL_DARK := Color(0.045, 0.045, 0.08, 0.9)
const TEXT := Color(0.92, 0.93, 0.97)
const MUTED := Color(0.56, 0.58, 0.68)
const BORDER := Color(1.0, 1.0, 1.0, 0.08)
const DANGER := Color(0.95, 0.25, 0.26)
const GOLD := Color(0.98, 0.75, 0.25)


static func flat(bg: Color, radius: int = 10, pad: float = 8.0, border: Color = Color(0, 0, 0, 0), border_w: int = 0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(pad)
	if border_w > 0:
		sb.border_color = border
		sb.set_border_width_all(border_w)
	sb.anti_aliasing = true
	sb.corner_detail = 8
	return sb


static func glass(radius: int = 18, pad: float = 12.0, alpha: float = 0.78) -> StyleBoxFlat:
	var sb := flat(Color(PANEL.r, PANEL.g, PANEL.b, alpha), radius, pad, BORDER, 1)
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 18
	sb.shadow_offset = Vector2(0, 6)
	return sb


static func pill(bg: Color, border: Color) -> StyleBoxFlat:
	var sb := flat(bg, 12, 0.0, border, 1)
	sb.content_margin_left = 9.0
	sb.content_margin_right = 9.0
	sb.content_margin_top = 2.0
	sb.content_margin_bottom = 2.0
	return sb


static func tag(bg: Color) -> StyleBoxFlat:
	var sb := flat(bg, 5, 0.0)
	sb.content_margin_left = 5.0
	sb.content_margin_right = 5.0
	sb.content_margin_top = 0.0
	sb.content_margin_bottom = 0.0
	return sb


static func style_button(b: Button, bg: Color, radius: int = 12) -> void:
	b.add_theme_stylebox_override("normal", flat(bg, radius, 10.0))
	b.add_theme_stylebox_override("hover", flat(bg.lightened(0.12), radius, 10.0))
	b.add_theme_stylebox_override("pressed", flat(bg.darkened(0.15), radius, 10.0))
	b.add_theme_stylebox_override("disabled", flat(Color(bg.r, bg.g, bg.b, 0.35), radius, 10.0))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("font_color", Color.WHITE)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", Color.WHITE)
	b.add_theme_color_override("font_focus_color", Color.WHITE)


static func linear_gradient(a: Color, b: Color) -> GradientTexture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 1.0])
	g.colors = PackedColorArray([a, b])
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.width = 64
	tex.height = 64
	tex.fill = GradientTexture2D.FILL_LINEAR
	tex.fill_from = Vector2(0.0, 0.0)
	tex.fill_to = Vector2(1.0, 1.0)
	return tex


static func radial_glow(c: Color, strength: float = 0.32) -> GradientTexture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 1.0])
	g.colors = PackedColorArray([Color(c.r, c.g, c.b, strength), Color(c.r, c.g, c.b, 0.0)])
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.width = 256
	tex.height = 256
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	return tex


static func build_theme() -> Theme:
	var t := Theme.new()
	t.default_font_size = 15

	# Labels
	t.set_color("font_color", "Label", TEXT)

	# Buttons
	t.set_stylebox("normal", "Button", flat(Color(1, 1, 1, 0.06), 10, 8.0))
	t.set_stylebox("hover", "Button", flat(Color(1, 1, 1, 0.11), 10, 8.0))
	t.set_stylebox("pressed", "Button", flat(Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.35), 10, 8.0))
	t.set_stylebox("disabled", "Button", flat(Color(1, 1, 1, 0.03), 10, 8.0))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_focus_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", MUTED)

	# LineEdit
	t.set_stylebox("normal", "LineEdit", flat(PANEL_DARK, 12, 12.0, BORDER, 1))
	t.set_stylebox("focus", "LineEdit", flat(Color(0, 0, 0, 0), 12, 12.0, Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.9), 2))
	t.set_stylebox("read_only", "LineEdit", flat(PANEL_DARK, 12, 12.0, BORDER, 1))
	t.set_color("font_color", "LineEdit", TEXT)
	t.set_color("font_placeholder_color", "LineEdit", Color(MUTED.r, MUTED.g, MUTED.b, 0.8))
	t.set_color("caret_color", "LineEdit", CYAN)
	t.set_color("selection_color", "LineEdit", Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.45))

	# Panels
	t.set_stylebox("panel", "PanelContainer", glass())
	t.set_stylebox("panel", "ScrollContainer", StyleBoxEmpty.new())

	# Progress bar
	t.set_stylebox("background", "ProgressBar", flat(Color(1, 1, 1, 0.08), 4, 0.0))
	t.set_stylebox("fill", "ProgressBar", flat(ACCENT.lerp(CYAN, 0.35), 4, 0.0))

	# Scrollbars
	var scroll_bg := flat(Color(0, 0, 0, 0), 4, 0.0)
	scroll_bg.content_margin_left = 3.0
	scroll_bg.content_margin_right = 3.0
	t.set_stylebox("scroll", "VScrollBar", scroll_bg)
	t.set_stylebox("scroll_focus", "VScrollBar", scroll_bg)
	t.set_stylebox("grabber", "VScrollBar", flat(Color(1, 1, 1, 0.12), 4, 0.0))
	t.set_stylebox("grabber_highlight", "VScrollBar", flat(Color(1, 1, 1, 0.22), 4, 0.0))
	t.set_stylebox("grabber_pressed", "VScrollBar", flat(Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.6), 4, 0.0))

	# Separators
	var line := StyleBoxLine.new()
	line.color = BORDER
	line.thickness = 1
	t.set_stylebox("separator", "HSeparator", line)
	t.set_constant("separation", "HSeparator", 6)

	# Tooltips
	t.set_stylebox("panel", "TooltipPanel", flat(Color(0.06, 0.06, 0.1, 0.96), 8, 8.0, BORDER, 1))
	t.set_color("font_color", "TooltipLabel", TEXT)
	return t
