extends RefCounted
## PulseSim: bot user generation, presence simulation and the keyword-intent reply engine.
## Intentionally has no class_name; main.gd loads it with preload() so a fresh
## headless CI export does not depend on the global class cache.

const Data = preload("res://scripts/data.gd")

var rng := RandomNumberGenerator.new()
var users: Array = []   # simulated humans (Dictionaries)
var bots: Array = []    # DM bots (Dictionaries)
var by_id: Dictionary = {}


func _init() -> void:
	rng.randomize()


# ------------------------------------------------------------------ generation

func generate(count: int) -> void:
	users.clear()
	bots.clear()
	by_id.clear()
	var names: Array = Data.FIRST_NAMES.duplicate()
	names.shuffle()
	var persona_keys: Array = Data.PERSONAS.keys()
	for i in range(count):
		var nm: String = names[i % names.size()]
		if i >= names.size():
			nm += str(rng.randi_range(2, 99))
		var persona: String = persona_keys[rng.randi_range(0, persona_keys.size() - 1)]
		var hex: String = Data.USER_COLORS[rng.randi_range(0, Data.USER_COLORS.size() - 1)]
		var u := {
			"id": "u%d" % i,
			"name": nm,
			"color": Color(hex),
			"initials": initials(nm),
			"persona": persona,
			"status": _random_status(),
			"activity": _random_activity(persona),
			"bot": false,
		}
		users.append(u)
		by_id[u["id"]] = u
	for b in Data.DM_BOTS:
		var bd: Dictionary = b
		var bhex: String = bd["color"]
		var bot := {
			"id": str(bd["id"]),
			"name": str(bd["name"]),
			"color": Color(bhex),
			"initials": initials(str(bd["name"])),
			"persona": str(bd["persona"]),
			"status": "online",
			"activity": str(bd["bio"]),
			"bio": str(bd["bio"]),
			"greeting": str(bd["greeting"]),
			"bot": true,
		}
		bots.append(bot)
		by_id[bot["id"]] = bot


static func initials(n: String) -> String:
	var parts := n.strip_edges().split(" ", false)
	if parts.is_empty():
		return "?"
	if parts.size() == 1:
		return parts[0].substr(0, 2).to_upper()
	return (parts[0].substr(0, 1) + parts[1].substr(0, 1)).to_upper()


func get_user(id: String) -> Dictionary:
	if by_id.has(id):
		return by_id[id]
	return {
		"id": id, "name": "Unknown", "color": Color(0.5, 0.5, 0.55), "initials": "?",
		"persona": "", "status": "offline", "activity": "", "bot": false,
	}


func _random_status() -> String:
	var r := rng.randf()
	if r < 0.45:
		return "online"
	if r < 0.65:
		return "idle"
	if r < 0.75:
		return "dnd"
	return "offline"


func _random_activity(persona: String) -> String:
	if not Data.PERSONAS.has(persona):
		return ""
	var p: Dictionary = Data.PERSONAS[persona]
	var acts: Array = p.get("activities", [])
	return _pick(acts)


func _pick(arr: Array) -> String:
	if arr.is_empty():
		return ""
	return str(arr[rng.randi_range(0, arr.size() - 1)])


# ------------------------------------------------------------------ presence

## Changes the status of `n` random users. Returns the ids that changed.
func tick_presence(n: int) -> Array:
	var changed: Array = []
	if users.is_empty():
		return changed
	for i in range(n):
		var u: Dictionary = users[rng.randi_range(0, users.size() - 1)]
		var old: String = u["status"]
		var nw := _next_status(old)
		if nw != old:
			u["status"] = nw
			if nw == "online":
				u["activity"] = _random_activity(str(u["persona"]))
			changed.append(u["id"])
	return changed


func _next_status(old: String) -> String:
	var r := rng.randf()
	match old:
		"online":
			if r < 0.45:
				return "idle"
			if r < 0.6:
				return "dnd"
			return "offline"
		"idle":
			if r < 0.6:
				return "online"
			return "offline"
		"dnd":
			if r < 0.7:
				return "online"
			return "idle"
	if r < 0.75:
		return "online"
	return "idle"


## Random user id. By default only online/idle users are picked.
func random_user_id(include_offline: bool = false) -> String:
	if users.is_empty():
		return ""
	if include_offline:
		var any: Dictionary = users[rng.randi_range(0, users.size() - 1)]
		return str(any["id"])
	var pool: Array = []
	for u in users:
		var st: String = u["status"]
		if st == "online" or st == "idle":
			pool.append(u["id"])
	if pool.is_empty():
		return ""
	return str(pool[rng.randi_range(0, pool.size() - 1)])


## Picks up to `n` responders, weighting users whose persona is interested in `intent`.
func pick_responders(intent: String, n: int, exclude: Array) -> Array:
	var pool: Array = []
	var weights: Array = []
	for u in users:
		var st: String = u["status"]
		if st == "offline" or exclude.has(u["id"]):
			continue
		var weight := 1.0
		if st == "idle":
			weight = 0.5
		elif st == "dnd":
			weight = 0.1
		var pkey: String = u["persona"]
		if Data.PERSONAS.has(pkey):
			var p: Dictionary = Data.PERSONAS[pkey]
			var interests: Array = p.get("interests", [])
			if interests.has(intent):
				weight *= 5.0
		pool.append(u["id"])
		weights.append(weight)
	var out: Array = []
	for k in range(n):
		if pool.is_empty():
			break
		var total := 0.0
		for wv in weights:
			total += float(wv)
		var r := rng.randf() * total
		var idx := pool.size() - 1
		for j in range(weights.size()):
			r -= float(weights[j])
			if r <= 0.0:
				idx = j
				break
		out.append(pool[idx])
		pool.remove_at(idx)
		weights.remove_at(idx)
	return out


## Returns the id of a user or bot @mentioned in the text, or "".
func find_mentioned(text: String) -> String:
	var low := text.to_lower()
	if not low.contains("@"):
		return ""
	for b in bots:
		if low.contains("@" + str(b["name"]).to_lower()):
			return str(b["id"])
	for u in users:
		if low.contains("@" + str(u["name"]).to_lower()):
			if str(u["status"]) == "offline":
				return ""
			return str(u["id"])
	return ""


# ------------------------------------------------------------------ text helpers

func normalize(text: String) -> String:
	var s := text.to_lower().replace("'", "")
	for ch in [".", ",", "!", "?", ";", ":", "\"", "(", ")", "[", "]", "{", "}", "/", "\\", "-", "_", "*", "~", "#"]:
		s = s.replace(str(ch), " ")
	return " ".join(s.split(" ", false))


func tokens(text: String) -> PackedStringArray:
	return normalize(text).split(" ", false)


func detect_intent(text: String) -> String:
	var low := normalize(text)
	var toks := low.split(" ", false)
	for entry in Data.INTENTS:
		var intent: String = entry[0]
		var kws: Array = entry[1]
		for kw in kws:
			var k: String = kw
			if k.contains(" "):
				if low.contains(k):
					return intent
			elif toks.has(k):
				return intent
	if text.strip_edges().ends_with("?"):
		return "question"
	if toks.size() > 0 and Data.QUESTION_WORDS.has(toks[0]):
		return "question"
	return "fallback"


func _guess_topic(text: String) -> String:
	var best := ""
	for t in tokens(text):
		var w := str(t)
		if w.length() > best.length() and w.length() > 3 and not Data.STOP_WORDS.has(w):
			best = w
	if best == "":
		best = "that"
	return best


func matches_answer(text: String, answers: Array) -> bool:
	var low := normalize(text)
	var toks := low.split(" ", false)
	for a in answers:
		var ans := normalize(str(a))
		if ans == "":
			continue
		if ans.contains(" "):
			if low.contains(ans):
				return true
		elif toks.has(ans):
			return true
	return false


func wrong_guess(answers: Array) -> String:
	for attempt in range(8):
		var q: Dictionary = Data.TRIVIA[rng.randi_range(0, Data.TRIVIA.size() - 1)]
		var d := str(q["d"])
		if not matches_answer(d, answers):
			return d.to_lower()
	return "no idea lol"


# ------------------------------------------------------------------ reply engine

const SOCIAL_INTENTS := ["greeting", "thanks", "bye", "compliment", "joke", "sad"]


func reply_for(uid: String, text: String, intent: String, player: String) -> String:
	var u := get_user(uid)
	var line := ""
	var pkey: String = u.get("persona", "")
	var persona: Dictionary = {}
	if Data.PERSONAS.has(pkey):
		persona = Data.PERSONAS[pkey]
	if intent == "joke":
		line = _pick(Data.JOKES)
	elif bool(u.get("bot", false)) and Data.BOT_REPLIES.has(uid):
		var interests: Array = persona.get("interests", [])
		if SOCIAL_INTENTS.has(intent) or interests.has(intent):
			line = _pick(Data.REPLIES.get(intent, Data.REPLIES["fallback"]))
		else:
			line = _pick(Data.BOT_REPLIES[uid])
	else:
		line = _pick(Data.REPLIES.get(intent, Data.REPLIES["fallback"]))
	line = line.format({"name": player, "me": str(u.get("name", "")), "topic": _guess_topic(text)})
	var flav: Array = persona.get("flavor", [])
	if not flav.is_empty() and not bool(u.get("bot", false)) and rng.randf() < 0.35:
		line += " " + _pick(flav)
	return line


func ambient_line(uid: String, channel: String, player: String) -> String:
	var u := get_user(uid)
	var line := ""
	var r := rng.randf()
	if player != "" and r < 0.07:
		line = _pick(Data.MENTION_LINES)
	elif r < 0.6 and Data.CHANNEL_LINES.has(channel):
		line = _pick(Data.CHANNEL_LINES[channel])
	else:
		var pkey: String = u.get("persona", "")
		if Data.PERSONAS.has(pkey):
			var p: Dictionary = Data.PERSONAS[pkey]
			line = _pick(p.get("lines", Data.GENERIC_LINES))
		else:
			line = _pick(Data.GENERIC_LINES)
	return line.format({"name": player, "me": str(u.get("name", ""))})


func bot_ping(bot_id: String) -> String:
	if Data.BOT_PINGS.has(bot_id):
		return _pick(Data.BOT_PINGS[bot_id])
	return "hey, just checking in!"


func persona_label(pkey: String) -> String:
	if Data.PERSONAS.has(pkey):
		var p: Dictionary = Data.PERSONAS[pkey]
		return str(p.get("label", ""))
	return ""
