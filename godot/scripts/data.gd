extends RefCounted
## Static content for Pulse Lite: names, personas, servers, channel seeds,
## reply templates, trivia and jokes. Accessed via preload("res://scripts/data.gd").
## Note: text is kept to characters covered by Godot's default font (no emoji),
## so it renders identically on desktop and Web.

const FIRST_NAMES := [
	"Ava", "Liam", "Mia", "Noah", "Zoe", "Kai", "Luna", "Leo", "Ivy", "Ezra",
	"Nova", "Milo", "Aria", "Finn", "Isla", "Jude", "Maya", "Owen", "Ruby", "Theo",
	"Sage", "Axel", "Cleo", "Dante", "Elle", "Felix", "Gia", "Hugo", "Iris", "Jax",
	"Kira", "Levi", "Mila", "Nico", "Opal", "Pax", "Quinn", "Rhea", "Silas", "Tess",
	"Umar", "Vera", "Wren", "Xan", "Yara", "Zane", "Remy", "Skye", "Rio", "Juno",
	"Asher", "Bea", "Cyrus", "Dara", "Enzo", "Faye", "Gus", "Hana", "Idris", "Jade",
	"Koa", "Lux", "Mo", "Nia",
]

const USER_COLORS := [
	"#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#f59e0b", "#ef4444", "#60a5fa",
	"#a3e635", "#fb7185", "#c084fc", "#2dd4bf", "#facc15", "#38bdf8", "#fb923c",
]

const PERSONAS := {
	"gamer": {
		"label": "Gamer",
		"interests": ["games"],
		"activities": ["Playing Valorant", "Playing Minecraft", "Playing Elden Ring", "Grinding ranked", "Watching speedruns"],
		"lines": [
			"just hit diamond in ranked, feeling unstoppable",
			"anyone up for some co-op tonight?",
			"the new patch notes are wild",
			"who else is still farming for that skin",
			"my aim today is a crime",
			"lfg duo queue, need a support main",
		],
		"flavor": ["gg", "ngl", "(lowkey cracked)", "let's gooo", "W"],
	},
	"student": {
		"label": "Student",
		"interests": ["homework", "sad"],
		"activities": ["Studying calculus", "Writing an essay", "Cramming for finals", "In the library"],
		"lines": [
			"pomodoro #4 done, brain is soup",
			"does anyone have notes for chapter 7?",
			"finals week is a lifestyle at this point",
			"just submitted my essay at 11:59 pm, living dangerously",
			"flashcards > rereading, change my mind",
			"study group in #study-hall in 10?",
		],
		"flavor": ["(send help)", "academic weapon mode", "lol", "fr"],
	},
	"artist": {
		"label": "Artist",
		"interests": ["compliment", "sad"],
		"activities": ["Sketching", "Painting in Procreate", "Working on commissions"],
		"lines": [
			"just finished a new piece, posting it in #art soon",
			"color theory is my love language",
			"drew hands today. they look like potatoes",
			"anyone want to do an art trade?",
			"sketchbook prep is starting early this year",
		],
		"flavor": ["(art brain)", "so pretty", ":)", "creative juices flowing"],
	},
	"dev": {
		"label": "Developer",
		"interests": ["coding"],
		"activities": ["Coding in Godot", "Fixing bugs", "Reviewing PRs", "Deploying to prod"],
		"lines": [
			"it works on my machine (tm)",
			"just renamed a variable everywhere and nothing broke. suspicious",
			"who decided timezones were a good idea",
			"shipping a hotfix on a friday, pray for me",
			"rubber duck debugging actually works, i'm convinced",
			"typescript caught a bug before it happened, love that",
		],
		"flavor": ["(ship it)", "lgtm", "no cap", "100%"],
	},
	"music": {
		"label": "Music lover",
		"interests": ["music"],
		"activities": ["Listening to lofi", "At a concert", "Making beats", "Practicing guitar"],
		"lines": [
			"this album has been on repeat all week",
			"drop your favorite song right now, no thinking",
			"made a new beat last night, kinda proud",
			"lofi + rain sounds = peak focus",
			"concert tickets secured!!",
		],
		"flavor": ["(vibing)", "on repeat", "banger", "<3"],
	},
	"foodie": {
		"label": "Foodie",
		"interests": ["food"],
		"activities": ["Cooking ramen", "Hunting for tacos", "Baking cookies"],
		"lines": [
			"made homemade ramen and i'm never going back",
			"hot take: pineapple on pizza is elite",
			"anyone have a good cookie recipe?",
			"it's snack o'clock",
			"found a taco place that changed my life",
		],
		"flavor": ["(hungry now)", "yum", "chef's kiss", "mmm"],
	},
	"memer": {
		"label": "Meme lord",
		"interests": ["joke", "fallback"],
		"activities": ["Scrolling memes", "Making memes", "Posting in #memes"],
		"lines": [
			"me: i'll sleep early. also me at 3am:",
			"this server is my roman empire",
			"posting cringe to stay humble",
			"no thoughts, just vibes",
			"why is the fridge so interesting at night",
		],
		"flavor": ["lmao", "xD", "dead", "(i'm wheezing)", "lol"],
	},
	"athlete": {
		"label": "Athlete",
		"interests": ["greeting", "compliment"],
		"activities": ["At the gym", "On a run", "Playing basketball"],
		"lines": [
			"leg day survived. barely.",
			"5k run done before breakfast",
			"hydrate or diedrate, everyone",
			"anyone watching the game tonight?",
		],
		"flavor": ["(stay hydrated)", "let's go", "beast mode"],
	},
	"bookworm": {
		"label": "Bookworm",
		"interests": ["question", "homework"],
		"activities": ["Reading fantasy", "At the bookstore", "Writing a story"],
		"lines": [
			"just finished a 700 page fantasy novel and i need to talk about it",
			"book club pick this month is so good",
			"currently reading three books at once, as one does",
			"the library is my happy place",
		],
		"flavor": ["(one more chapter)", "plot twist", ":)"],
	},
}

const GENERIC_LINES := [
	"what's everyone up to?",
	"today has been a whole day",
	"ok who's still awake",
	"good vibes only in here",
	"this server is so cozy",
]

const SERVERS := [
	{"id": "hq", "name": "Pulse HQ", "color": "#7c5cff", "channels": ["general", "announcements", "memes", "random"]},
	{"id": "games", "name": "Gamer Lounge", "color": "#ef4444", "channels": ["gaming", "lfg", "clips", "memes"]},
	{"id": "study", "name": "Study Hall", "color": "#22c55e", "channels": ["study-hall", "homework-help", "resources", "pomodoro"]},
	{"id": "dev", "name": "Dev Den", "color": "#22d3ee", "channels": ["dev-chat", "show-and-tell", "bugs", "career"]},
	{"id": "art", "name": "Art and Music", "color": "#f59e0b", "channels": ["art", "music", "playlists", "food"]},
]

const CHANNEL_TOPICS := {
	"general": "Hang out, say hi, meet people.",
	"announcements": "News and updates about Pulse.",
	"memes": "Quality memes only (results may vary).",
	"random": "Anything goes.",
	"gaming": "What are you playing right now?",
	"lfg": "Looking for group - find your squad.",
	"clips": "Post your best (and worst) plays.",
	"study-hall": "Quiet focus. Accountability buddies welcome.",
	"homework-help": "Stuck? Ask here. No judgement.",
	"resources": "Notes, guides and useful links.",
	"pomodoro": "25 minutes on, 5 minutes off.",
	"dev-chat": "Code talk, tools, frameworks.",
	"show-and-tell": "Show off what you built.",
	"bugs": "It's not a bug, it's a feature.",
	"career": "Internships, interviews, resumes.",
	"art": "Share your art, get feedback.",
	"music": "What's on your playlist?",
	"playlists": "Curated vibes for every mood.",
	"food": "Recipes, snacks and food pics.",
}

const CHANNEL_LINES := {
	"general": [
		"good morning pulse fam",
		"how is everyone doing today?",
		"just joined, this place looks cool",
		"what's the vibe in here today",
		"who wants to start a movie night?",
	],
	"announcements": [
		"Reminder: be kind, have fun, touch grass occasionally.",
		"New channels are live in Study Hall!",
		"Weekly trivia night this Friday - type /trivia to warm up.",
	],
	"memes": [
		"me pretending to understand the group project",
		"when the wifi drops for one second: panic",
		"nobody: absolutely nobody: me at 2am making a playlist",
		"i put the 'pro' in procrastination",
		"my last brain cell during finals: *elevator music*",
	],
	"random": [
		"if you could teleport anywhere right now, where?",
		"hot take: cereal is a soup",
		"just saw a dog wearing boots, today is good",
		"what's the most useless talent you have?",
	],
	"gaming": [
		"what's everyone playing this weekend?",
		"the new open world game is massive, i'm lost",
		"indie games are carrying this year honestly",
		"anyone else still playing minecraft in 2026?",
		"controller or keyboard and mouse? choose wisely",
	],
	"lfg": [
		"need 2 more for a raid, who's in?",
		"chill duo for casual matches?",
		"lf squad, mic optional, vibes mandatory",
		"ranked grind tonight, need a support",
	],
	"clips": [
		"just hit the cleanest 1v3 of my life",
		"clip of me falling off a cliff for the 10th time",
		"that headshot was 100% skill and 0% luck. trust",
	],
	"study-hall": [
		"starting a 50 minute focus block, join me",
		"done with chapter 3, rewarding myself with a snack",
		"who else is studying right now?",
		"library is packed today",
	],
	"homework-help": [
		"can someone explain derivatives like i'm five?",
		"how do you cite a website in APA again?",
		"stuck on a physics problem about friction",
		"anyone good at chemistry? balancing equations is pain",
	],
	"resources": [
		"posted my calculus notes, hope they help",
		"this free typing site boosted my speed a lot",
		"khan academy saved my grade, not even kidding",
	],
	"pomodoro": [
		"break time! stretch, hydrate, come back",
		"next pomodoro starts in 2 minutes",
		"4 sessions done today, feeling productive",
	],
	"dev-chat": [
		"tabs or spaces? (wrong answers only)",
		"just tried godot for the first time, it's so lightweight",
		"next.js app router finally clicked for me",
		"what's your favorite vs code extension?",
		"rewrote it in rust. it's still broken but faster",
	],
	"show-and-tell": [
		"made a tiny chat app over the weekend",
		"my first game jam entry is up!",
		"built a habit tracker, feedback welcome",
	],
	"bugs": [
		"found a bug where the button only works on tuesdays",
		"the bug disappeared when i added a print. classic",
		"anyone seen 'undefined is not a function' today? asking for a friend",
	],
	"career": [
		"got my first internship interview!!",
		"resume tip: put your projects at the top",
		"leetcode grind day 12",
	],
	"art": [
		"finished a digital painting today",
		"anyone have tips for drawing hands?",
		"trying a new color palette, purple and cyan",
		"posting my sketchbook progress",
	],
	"music": [
		"what's the last song you listened to?",
		"lofi beats to chat to",
		"anyone going to a concert soon?",
		"guitar practice day 30, fingers hurt",
	],
	"playlists": [
		"made a rainy day playlist, link in bio (jk)",
		"study playlist: no lyrics, all vibes",
		"workout playlist needs more bangers, suggestions?",
	],
	"food": [
		"made pancakes from scratch today",
		"best late night snack? go",
		"ramen tier list incoming",
		"tried sushi for the first time and wow",
	],
}

const DM_BOTS := [
	{
		"id": "bot_pulse", "name": "PulseBot", "color": "#7c5cff", "persona": "bot",
		"bio": "Your friendly helper bot. Ask me anything!",
		"greeting": "Hey! I'm PulseBot. Try /help, /trivia or /poll in any channel.",
	},
	{
		"id": "bot_trivia", "name": "TriviaBot", "color": "#22d3ee", "persona": "bot",
		"bio": "Say 'play' to start a trivia round.",
		"greeting": "Want a trivia round? Just say play! First right answer wins XP.",
	},
	{
		"id": "bot_luna", "name": "Luna", "color": "#f472b6", "persona": "music",
		"bio": "Lofi DJ - always has a playlist ready.",
		"greeting": "hiii, need some music recs? i got you.",
	},
	{
		"id": "bot_byte", "name": "Byte", "color": "#34d399", "persona": "dev",
		"bio": "Rubber duck for your code problems.",
		"greeting": "Byte here. Paste your bug, I'll pretend to understand it.",
	},
]

## Intent detection, in priority order: [intent, [keywords]].
## Multi-word keywords use substring matching; single words use token matching.
const INTENTS := [
	["joke", ["joke", "jokes", "funny", "pun", "puns", "make me laugh", "tell me something funny"]],
	["games", ["game", "games", "gaming", "gamer", "play", "playing", "minecraft", "valorant", "fortnite", "league", "zelda", "steam", "xbox", "playstation", "ps5", "switch", "fps", "rpg", "lfg", "ranked", "gg", "controller", "raid", "speedrun"]],
	["music", ["music", "song", "songs", "album", "playlist", "spotify", "band", "concert", "lofi", "rap", "jazz", "guitar", "piano", "listening", "beat", "beats", "singer", "kpop"]],
	["homework", ["homework", "hw", "exam", "exams", "test", "study", "studying", "essay", "assignment", "class", "math", "calculus", "physics", "chemistry", "history", "teacher", "finals", "quiz", "grade", "school", "college", "midterm", "biology"]],
	["coding", ["code", "coding", "bug", "bugs", "javascript", "python", "react", "godot", "gdscript", "typescript", "rust", "api", "compile", "deploy", "git", "github", "programming", "developer", "css", "html", "nextjs", "database", "sql", "error", "function"]],
	["food", ["food", "hungry", "pizza", "eat", "eating", "lunch", "dinner", "breakfast", "snack", "snacks", "ramen", "sushi", "burger", "tacos", "coffee", "tea", "cook", "cooking", "recipe", "pancakes"]],
	["sad", ["sad", "tired", "stressed", "bored", "lonely", "anxious", "ugh", "exhausted", "rough day", "bad day", "not okay"]],
	["thanks", ["thanks", "thank", "thx", "ty", "appreciate"]],
	["compliment", ["love", "awesome", "amazing", "great", "nice", "cool", "beautiful", "best", "legend", "goat", "good job", "well done"]],
	["greeting", ["hi", "hello", "hey", "yo", "sup", "hiya", "howdy", "gm", "heyy", "hii", "hola", "good morning", "good evening", "whats up"]],
	["bye", ["bye", "goodbye", "gn", "goodnight", "good night", "cya", "ttyl", "see ya"]],
]

const QUESTION_WORDS := ["what", "why", "how", "who", "when", "where", "which", "is", "are", "can", "should", "do", "does", "will", "would", "could", "anyone"]

const STOP_WORDS := [
	"the", "and", "that", "this", "with", "have", "what", "your", "from", "they", "just",
	"about", "really", "would", "there", "their", "which", "think", "because", "been",
	"were", "when", "like", "know", "dont", "cant", "into", "some", "then", "than",
]

const REPLIES := {
	"greeting": [
		"hey {name}!",
		"yo {name}, what's up?",
		"hiii {name} :D",
		"welcome welcome, {name}!",
		"hey hey! how's your day going?",
		"sup {name}",
	],
	"question": [
		"good question, honestly i think it depends",
		"hmm, let me think... probably yes?",
		"i was literally wondering the same thing",
		"someone in #resources posted about that earlier",
		"short answer: maybe. long answer: also maybe lol",
		"great question {name}, anyone else know?",
	],
	"games": [
		"omg yes, are you playing tonight?",
		"i've been grinding that all week",
		"add me, let's queue up later",
		"that game is so good, what rank are you?",
		"gamer moment. respect",
		"have you tried the new update yet?",
	],
	"music": [
		"ooh what genre are you into?",
		"send the playlist {name}!",
		"that artist is so underrated",
		"i need new music recs, go",
		"music taste: immaculate",
		"putting that on right now",
	],
	"homework": [
		"ugh same, the workload is insane",
		"want to do a study session in #study-hall?",
		"pro tip: pomodoro timer, 25 min on, 5 off",
		"you got this {name}, one problem at a time",
		"which class? maybe i can help",
		"explain it to a rubber duck, works every time",
	],
	"coding": [
		"have you tried turning it off and on again?",
		"check the console, it's always a typo",
		"ooh what are you building?",
		"git commit -m \"fix stuff\" energy",
		"post a snippet in #dev-chat, we'll take a look",
		"is it a missing semicolon? it's always a missing semicolon",
	],
	"food": [
		"now i'm hungry, thanks {name}",
		"that sounds delicious",
		"ramen is always the answer",
		"what are you eating??",
		"food talk is the best talk",
		"ok but pizza though",
	],
	"sad": [
		"sending good vibes your way {name}",
		"that's rough, take a break, you deserve it",
		"here if you want to talk",
		"hydrate, snack, nap. in that order",
		"it'll get better, promise",
	],
	"thanks": [
		"anytime {name}!",
		"no problem :)",
		"happy to help",
		"you're welcome!",
	],
	"compliment": [
		"aww thank you {name} <3",
		"you're too kind",
		"no YOU'RE awesome",
		"this made my day",
		"appreciate you!",
	],
	"bye": [
		"see ya {name}!",
		"later! don't be a stranger",
		"gn {name}, sleep well",
		"bye bye!",
	],
	"fallback": [
		"lol fair",
		"real",
		"wait tell me more about {topic}",
		"{topic}? interesting",
		"honestly same",
		"valid",
		"hmm say more",
		"that's a mood",
		"ok but why is that so true",
		"noted",
	],
}

const BOT_REPLIES := {
	"bot_pulse": [
		"I'm just a humble bot, but try /help to see what I can do!",
		"Fun fact: you earn XP for every message. Level up!",
		"Tip: /poll Question|A|B starts a vote.",
		"Tip: /roll 2d6 rolls dice. Feeling lucky?",
		"Tip: click a reaction under a message to add yours.",
		"Did you know? Your streak grows each day you visit.",
	],
	"bot_trivia": [
		"Say 'play' to start a trivia round!",
		"I've got questions. Do you have answers? Say 'play'.",
		"Ready when you are - type 'trivia'.",
	],
	"bot_luna": [
		"now playing: rainy day lofi beats",
		"try this: jazz piano + rain sounds",
		"music rec: anything with a saxophone solo",
		"my current mood is a slow synthwave track",
		"you'd like dream pop, trust me",
	],
	"bot_byte": [
		"Have you tried logging the value right before it breaks?",
		"Read the error message slowly. Then read it again.",
		"Break the problem into smaller functions.",
		"Commit early, commit often.",
		"Write a tiny test case that reproduces it.",
	],
}

const BOT_PINGS := {
	"bot_pulse": ["Psst - you can type /trivia in any channel to start a round.", "Daily tip: reactions give you a little XP too."],
	"bot_trivia": ["Bored? Say 'play' and I'll quiz you.", "Trivia night is better with you. Say 'play'!"],
	"bot_luna": ["made you a playlist: 'late night chats'. you're welcome", "what are you listening to right now?"],
	"bot_byte": ["Reminder: take a break from the screen, your bugs will wait.", "Shipped anything cool lately?"],
}

const MENTION_LINES := [
	"@{name} what do you think?",
	"@{name} you around?",
	"has anyone seen @{name} today?",
	"@{name} settle this debate for us",
	"@{name} we should team up later!",
]

const JOKES := [
	"Why do programmers prefer dark mode? Because light attracts bugs.",
	"I told my computer I needed a break, and it said: no problem, I'll go to sleep.",
	"Why did the scarecrow win an award? He was outstanding in his field.",
	"Why don't skeletons fight each other? They don't have the guts.",
	"What do you call a fake noodle? An impasta.",
	"Why was the math book sad? It had too many problems.",
	"I'm reading a book about anti-gravity. It's impossible to put down.",
	"Why did the gamer bring a ladder? To reach the next level.",
	"What's a computer's favorite snack? Microchips.",
	"Why did the developer go broke? Because he used up all his cache.",
	"How does a penguin build its house? Igloos it together.",
	"Why can't you trust atoms? They make up everything.",
]

const TRIVIA := [
	{"q": "What is the capital of France?", "a": ["paris"], "d": "Paris"},
	{"q": "How many legs does a spider have?", "a": ["8", "eight"], "d": "8"},
	{"q": "What planet is known as the Red Planet?", "a": ["mars"], "d": "Mars"},
	{"q": "What is the chemical symbol for gold?", "a": ["au"], "d": "Au"},
	{"q": "What is the largest ocean on Earth?", "a": ["pacific"], "d": "Pacific"},
	{"q": "Who painted the Mona Lisa?", "a": ["da vinci", "davinci", "leonardo"], "d": "Leonardo da Vinci"},
	{"q": "What is 7 x 8?", "a": ["56", "fifty six"], "d": "56"},
	{"q": "What gas do plants absorb from the air?", "a": ["co2", "carbon dioxide"], "d": "Carbon dioxide"},
	{"q": "How many continents are there?", "a": ["7", "seven"], "d": "7"},
	{"q": "What is the fastest land animal?", "a": ["cheetah"], "d": "Cheetah"},
	{"q": "In what year did the first iPhone launch?", "a": ["2007"], "d": "2007"},
	{"q": "What is the hardest natural substance?", "a": ["diamond", "diamonds"], "d": "Diamond"},
	{"q": "Which language is used to style web pages?", "a": ["css"], "d": "CSS"},
	{"q": "In which game do you mine blocks and avoid creepers?", "a": ["minecraft"], "d": "Minecraft"},
	{"q": "What is the smallest prime number?", "a": ["2", "two"], "d": "2"},
	{"q": "Which planet has the most famous rings?", "a": ["saturn"], "d": "Saturn"},
	{"q": "What is the boiling point of water in Celsius?", "a": ["100"], "d": "100"},
	{"q": "How many sides does a hexagon have?", "a": ["6", "six"], "d": "6"},
	{"q": "Which instrument usually has 88 keys?", "a": ["piano"], "d": "Piano"},
	{"q": "What is the tallest mountain in the world?", "a": ["everest"], "d": "Mount Everest"},
	{"q": "What does CPU stand for?", "a": ["central processing unit"], "d": "Central Processing Unit"},
	{"q": "Which animal is known as the king of the jungle?", "a": ["lion"], "d": "Lion"},
	{"q": "What is the largest planet in our solar system?", "a": ["jupiter"], "d": "Jupiter"},
	{"q": "What color do you get by mixing blue and yellow?", "a": ["green"], "d": "Green"},
	{"q": "Who wrote Romeo and Juliet?", "a": ["shakespeare"], "d": "Shakespeare"},
	{"q": "What is H2O more commonly called?", "a": ["water"], "d": "Water"},
]

## Reactions are short text tokens so they render with the default font everywhere.
const REACTIONS := ["+1", "lol", "<3", ":D", "GG", "W", "wow", "fire", "100", "xD", ":O", "pog"]
