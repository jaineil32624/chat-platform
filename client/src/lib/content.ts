// Static content packs: emoji, built-in animated GIFs, stickers, trivia, meme templates.

export const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  { name: "Smileys", icon: "😀", emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👻 👽 🤖".split(" ") },
  { name: "Gestures", icon: "👍", emojis: "👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 💪 🦾 🖕 ✍️ 🤳 💅 👀 🧠 🫶".split(" ") },
  { name: "Hearts", icon: "❤️", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ❤️‍🔥 ✨ ⭐ 🌟 💫 🔥 💥 💯 ✅ ❌ ⚡".split(" ") },
  { name: "Activities", icon: "🎮", emojis: "🎮 🕹️ 🎲 ♟️ 🎯 🎳 🏀 ⚽ 🏈 ⚾ 🎾 🏐 🏓 🥊 🎸 🎹 🥁 🎤 🎧 🎬 🎨 🧩 🏆 🥇 🎉 🎊 🎈 🎁".split(" ") },
  { name: "Food", icon: "🍕", emojis: "🍕 🍔 🍟 🌭 🌮 🌯 🍣 🍜 🍝 🍩 🍪 🎂 🍰 🧁 🍫 🍿 🍓 🍉 🍌 🍎 🥑 🌶️ ☕ 🧋 🍵 🥤 🍺".split(" ") },
  { name: "Nature", icon: "🌸", emojis: "🌸 🌺 🌻 🌹 🌷 🌱 🌲 🌴 🍀 🍁 🌈 ☀️ 🌙 ⭐ ☁️ ❄️ 🌊 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐸 🐵 🐧 🦄 🐙 🦋".split(" ") },
  { name: "Objects", icon: "💡", emojis: "💡 📱 💻 ⌨️ 🖥️ 📷 📚 📝 ✏️ 📌 📎 🔒 🔑 🛡️ 🚀 🛸 🎓 💼 📈 📊 🗓️ ⏰ 🔔 📣 💰 💎 🧪 🔬".split(" ") },
];

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🎉", "👀", "💯"];

export interface BuiltinGif {
  id: string;
  title: string;
  emoji: string;
  gradient: string;
  tags: string[];
  motion: "bounce" | "spin" | "shake" | "pulse" | "float" | "wiggle";
}

// Animated "GIF" tiles rendered with CSS — zero network dependency, always on-brand.
export const BUILTIN_GIFS: BuiltinGif[] = [
  { id: "g-party", title: "Party time", emoji: "🥳", gradient: "from-fuchsia-500 via-pink-500 to-orange-400", tags: ["party", "celebrate", "yay"], motion: "bounce" },
  { id: "g-fire", title: "This is fire", emoji: "🔥", gradient: "from-orange-500 via-red-500 to-yellow-400", tags: ["fire", "lit", "hot"], motion: "pulse" },
  { id: "g-mind", title: "Mind blown", emoji: "🤯", gradient: "from-violet-600 via-purple-500 to-cyan-400", tags: ["wow", "mind", "blown"], motion: "shake" },
  { id: "g-lol", title: "LOL", emoji: "😂", gradient: "from-yellow-400 via-amber-400 to-orange-500", tags: ["lol", "funny", "laugh"], motion: "wiggle" },
  { id: "g-gg", title: "GG", emoji: "🏆", gradient: "from-amber-300 via-yellow-500 to-lime-400", tags: ["gg", "win", "trophy"], motion: "float" },
  { id: "g-rocket", title: "To the moon", emoji: "🚀", gradient: "from-sky-500 via-indigo-500 to-violet-600", tags: ["launch", "ship", "moon"], motion: "float" },
  { id: "g-cat", title: "Cat vibes", emoji: "😼", gradient: "from-teal-400 via-emerald-500 to-green-600", tags: ["cat", "vibe"], motion: "wiggle" },
  { id: "g-wave", title: "Hey there", emoji: "👋", gradient: "from-cyan-400 via-sky-500 to-blue-600", tags: ["hi", "hello", "wave"], motion: "wiggle" },
  { id: "g-sad", title: "So sad", emoji: "😭", gradient: "from-slate-500 via-blue-600 to-indigo-700", tags: ["sad", "cry"], motion: "shake" },
  { id: "g-love", title: "Love it", emoji: "😍", gradient: "from-rose-400 via-pink-500 to-fuchsia-600", tags: ["love", "heart"], motion: "pulse" },
  { id: "g-think", title: "Hmm…", emoji: "🤔", gradient: "from-stone-400 via-zinc-500 to-neutral-700", tags: ["think", "hmm"], motion: "float" },
  { id: "g-dance", title: "Dance break", emoji: "💃", gradient: "from-pink-500 via-rose-500 to-red-500", tags: ["dance", "music"], motion: "spin" },
  { id: "g-coffee", title: "Need coffee", emoji: "☕", gradient: "from-amber-700 via-orange-800 to-stone-800", tags: ["coffee", "tired", "morning"], motion: "float" },
  { id: "g-ok", title: "Sounds good", emoji: "👌", gradient: "from-emerald-400 via-teal-500 to-cyan-600", tags: ["ok", "yes", "agree"], motion: "bounce" },
  { id: "g-skull", title: "I'm dead", emoji: "💀", gradient: "from-zinc-700 via-neutral-800 to-black", tags: ["dead", "lmao"], motion: "shake" },
  { id: "g-sparkle", title: "Magic", emoji: "✨", gradient: "from-indigo-400 via-purple-400 to-pink-400", tags: ["magic", "sparkle"], motion: "spin" },
];

export const STICKER_PACKS: { name: string; stickers: string[] }[] = [
  { name: "Pulse Pals", stickers: ["🐱‍💻", "🦊", "🐼", "🐸", "🦄", "🐙", "🐧", "🦖"] },
  { name: "Reactions", stickers: ["💯", "🫡", "🫠", "🤌", "🙏", "🫶", "🤝", "👑"] },
  { name: "Vibes", stickers: ["🌈", "🌙", "☄️", "🪐", "🌊", "🍄", "🌵", "🎧"] },
];

export const MEME_TEMPLATES = [
  { id: "m1", name: "Galaxy Brain", gradient: ["#7c3aed", "#06b6d4"], emoji: "🧠" },
  { id: "m2", name: "This Is Fine", gradient: ["#f97316", "#7f1d1d"], emoji: "🔥" },
  { id: "m3", name: "Stonks", gradient: ["#1e3a8a", "#10b981"], emoji: "📈" },
  { id: "m4", name: "Surprised", gradient: ["#f59e0b", "#ec4899"], emoji: "😱" },
  { id: "m5", name: "Big Mood", gradient: ["#0f172a", "#6366f1"], emoji: "😌" },
  { id: "m6", name: "Doge", gradient: ["#fde68a", "#d97706"], emoji: "🐕" },
];

export interface TriviaQuestion {
  q: string;
  choices: string[];
  answer: number;
  category: string;
}

export const TRIVIA: TriviaQuestion[] = [
  { q: "What does HTTP stand for?", choices: ["HyperText Transfer Protocol", "High Transfer Text Process", "Hyperlink Text Transport", "Home Tool Transfer Protocol"], answer: 0, category: "Tech" },
  { q: "Which planet has the most moons (as of 2024)?", choices: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1, category: "Science" },
  { q: "Who painted the Mona Lisa?", choices: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], answer: 2, category: "Art" },
  { q: "What is the time complexity of binary search?", choices: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], answer: 1, category: "Tech" },
  { q: "What is the chemical symbol for gold?", choices: ["Ag", "Gd", "Au", "Go"], answer: 2, category: "Science" },
  { q: "Which language runs natively in web browsers?", choices: ["Python", "JavaScript", "C#", "Rust"], answer: 1, category: "Tech" },
  { q: "How many sides does a hexagon have?", choices: ["5", "6", "7", "8"], answer: 1, category: "Math" },
  { q: "What year did the first iPhone release?", choices: ["2005", "2007", "2009", "2010"], answer: 1, category: "Tech" },
  { q: "What's the largest ocean on Earth?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3, category: "Geography" },
  { q: "Which game features the 'Creeper'?", choices: ["Fortnite", "Minecraft", "Roblox", "Terraria"], answer: 1, category: "Gaming" },
  { q: "What is the powerhouse of the cell?", choices: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], answer: 2, category: "Science" },
  { q: "What does CSS stand for?", choices: ["Cascading Style Sheets", "Creative Style System", "Computer Styled Syntax", "Colorful Sheet Styles"], answer: 0, category: "Tech" },
  { q: "Which country hosted the 2016 Summer Olympics?", choices: ["China", "UK", "Brazil", "Japan"], answer: 2, category: "Sports" },
  { q: "What's 2⁸?", choices: ["128", "256", "512", "64"], answer: 1, category: "Math" },
  { q: "Who wrote 'Romeo and Juliet'?", choices: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], answer: 1, category: "Literature" },
  { q: "Who created Git?", choices: ["Bill Gates", "Linus Torvalds", "Guido van Rossum", "Tim Berners-Lee"], answer: 1, category: "Tech" },
  { q: "What's the fastest land animal?", choices: ["Lion", "Pronghorn", "Cheetah", "Greyhound"], answer: 2, category: "Nature" },
  { q: "In which year did humans first land on the Moon?", choices: ["1965", "1969", "1972", "1959"], answer: 1, category: "History" },
];

export const WALLPAPERS = {
  aurora: "radial-gradient(1200px 600px at 10% -10%, rgb(var(--accent) / 0.18), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgb(var(--accent2) / 0.14), transparent 60%)",
  mesh: "radial-gradient(at 20% 20%, rgb(var(--accent) / 0.15) 0, transparent 50%), radial-gradient(at 80% 0%, rgb(var(--accent2) / 0.12) 0, transparent 50%), radial-gradient(at 50% 100%, rgb(var(--accent) / 0.1) 0, transparent 50%)",
  grid: "linear-gradient(rgb(var(--line) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.35) 1px, transparent 1px)",
  none: "none",
} as const;

export const ACCENT_PRESETS = [
  { name: "Pulse", accent: "#7c5cff", accent2: "#22d3ee" },
  { name: "Sunset", accent: "#f43f5e", accent2: "#f59e0b" },
  { name: "Forest", accent: "#10b981", accent2: "#84cc16" },
  { name: "Ocean", accent: "#0ea5e9", accent2: "#6366f1" },
  { name: "Candy", accent: "#ec4899", accent2: "#a855f7" },
  { name: "Mono", accent: "#a1a1aa", accent2: "#e4e4e7" },
];
