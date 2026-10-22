extends Control
## Tiny message-status indicator: 0 = sending (ring), 1 = sent (one check),
## 2 = delivered (two checks), 3 = read (two cyan checks).

const MUTED := Color(0.58, 0.6, 0.7)
const READ := Color(0.133, 0.827, 0.933)

var state: int = 0


func _init() -> void:
	custom_minimum_size = Vector2(18, 12)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_state(s: int) -> void:
	state = s
	queue_redraw()


func _draw() -> void:
	var col := MUTED
	if state >= 3:
		col = READ
	if state <= 0:
		draw_arc(Vector2(6, 6), 4.0, 0.0, TAU, 16, col, 1.2, true)
		return
	_check(Vector2(0, 0), col)
	if state >= 2:
		_check(Vector2(6, 0), col)


func _check(o: Vector2, col: Color) -> void:
	var pts := PackedVector2Array([o + Vector2(1.0, 6.5), o + Vector2(4.0, 9.5), o + Vector2(10.5, 2.5)])
	draw_polyline(pts, col, 1.6, true)
