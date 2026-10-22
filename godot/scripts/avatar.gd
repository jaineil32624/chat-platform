extends Control
## Circular avatar with initials and an optional presence dot, drawn entirely in code.

const RING_COLOR := Color(0.06, 0.06, 0.1)

var bg_color: Color = Color(0.486, 0.361, 1.0)
var initials: String = "?"
var status: String = ""
var diameter: float = 40.0


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(diameter, diameter)


func setup(c: Color, txt: String, d: float, st: String = "") -> void:
	bg_color = c
	initials = txt
	diameter = d
	status = st
	custom_minimum_size = Vector2(d, d)
	size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	queue_redraw()


func set_status(st: String) -> void:
	status = st
	queue_redraw()


static func status_color(st: String) -> Color:
	match st:
		"online":
			return Color(0.14, 0.65, 0.35)
		"idle":
			return Color(0.94, 0.7, 0.2)
		"dnd":
			return Color(0.95, 0.25, 0.26)
	return Color(0.5, 0.52, 0.56)


func _draw() -> void:
	var r := diameter * 0.5
	var c := Vector2(r, r)
	# Base disc + soft top highlight + antialiased rim.
	draw_circle(c, r, bg_color)
	draw_circle(c - Vector2(0.0, r * 0.35), r * 0.55, Color(1, 1, 1, 0.1))
	draw_arc(c, r - 0.5, 0.0, TAU, 48, bg_color.darkened(0.1), 1.2, true)

	# Initials
	var font := get_theme_default_font()
	if font != null:
		var fs := int(maxf(9.0, diameter * 0.38))
		var asc := font.get_ascent(fs)
		var desc := font.get_descent(fs)
		var baseline := r + (asc - desc) * 0.5
		draw_string(font, Vector2(0.0, baseline), initials, HORIZONTAL_ALIGNMENT_CENTER, diameter, fs, Color(1, 1, 1, 0.96))

	# Presence dot
	if status != "":
		var dr := maxf(4.0, diameter * 0.16)
		var dc := Vector2(diameter - dr, diameter - dr)
		draw_circle(dc, dr + 2.5, RING_COLOR)
		draw_circle(dc, dr, status_color(status))
		if status == "idle":
			draw_circle(dc + Vector2(-dr * 0.45, -dr * 0.45), dr * 0.62, RING_COLOR)
		elif status == "dnd":
			draw_rect(Rect2(dc.x - dr * 0.6, dc.y - dr * 0.2, dr * 1.2, dr * 0.4), RING_COLOR)
		elif status == "offline":
			draw_circle(dc, dr * 0.5, RING_COLOR)
