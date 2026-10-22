import type { Presence, User } from "../types";
import { seeded } from "../utils";

export interface Persona {
  key: string;
  label: string;
  interests: string[];
  emojiRate: number; // 0..1 likelihood of adding emoji
  lowercase: boolean;
  slang: string[];
  emojis: string[];
  openers: string[]; // ambient conversation starters
  bios: string[];
  badges: string[];
}

export const PERSONAS: Persona[] = [
  {
    key: "gamer", label: "Gamer", interests: ["gaming", "esports", "speedruns"], emojiRate: 0.6, lowercase: true,
    slang: ["fr", "ngl", "lowkey", "gg", "no cap"], emojis: ["🎮", "🔥", "💀", "😤", "🏆"],
    openers: ["anyone tryna queue ranked later?", "just hit a new PB on my speedrun 😤", "new patch notes dropped and my main got nerfed again", "is it just me or is matchmaking cooked today", "who's up for some co-op tonight", "that final boss took me 40 tries ngl"],
    bios: ["Diamond rank, bronze sleep schedule", "Speedrunner • Controller > keyboard (fight me)", "Probably in a lobby right now"], badges: ["gamer"],
  },
  {
    key: "student", label: "Student", interests: ["homework", "exams", "study"], emojiRate: 0.4, lowercase: false,
    slang: ["honestly", "literally", "lol"], emojis: ["📚", "😩", "☕", "✏️", "🧠"],
    openers: ["Does anyone understand the chem homework? I'm so lost 😩", "Study session in #study-hall in 10 if anyone wants to join", "Finals week is approaching and I'm not okay", "Just finished my essay at 2am, love that for me", "Anyone have good flashcard apps?", "Pomodoro gang where you at ☕"],
    bios: ["CS major • Coffee-powered", "Pre-med and pre-tired", "Library is my second home"], badges: ["helper"],
  },
  {
    key: "dev", label: "Developer", interests: ["coding", "typescript", "open source"], emojiRate: 0.3, lowercase: false,
    slang: ["tbh", "imo", "ship it"], emojis: ["💻", "🚀", "🐛", "⚡", "🤖"],
    openers: ["Spent 3 hours debugging only to find a missing semicolon 🐛", "Hot take: tabs > spaces", "Just shipped a new side project, would love feedback!", "Anyone tried the new React compiler yet?", "TypeScript saved me from myself again today", "It works on my machine ¯\\_(ツ)_/¯"],
    bios: ["Full-stack dev • Rust curious", "I turn coffee into pull requests", "Open source enjoyer"], badges: ["dev"],
  },
  {
    key: "artist", label: "Artist", interests: ["art", "drawing", "design"], emojiRate: 0.7, lowercase: false,
    slang: ["omg", "sooo", "vibes"], emojis: ["🎨", "✨", "🌸", "🖌️", "💜"],
    openers: ["Finished a new piece today ✨ the lighting took forever", "What's everyone's favorite color palette lately?", "Art block is real, send inspiration 🌸", "Just got a new drawing tablet and I'm obsessed", "Doing a sketch-a-day challenge, day 12!", "Who else listens to lofi while drawing? 🎧"],
    bios: ["Digital illustrator • Commissions open", "Painting feelings in pixels", "Color theory nerd"], badges: ["artist"],
  },
  {
    key: "music", label: "Music Lover", interests: ["music", "concerts", "playlists"], emojiRate: 0.6, lowercase: true,
    slang: ["bro", "lowkey", "on repeat"], emojis: ["🎧", "🎶", "🎸", "🔥", "💿"],
    openers: ["this album has been on repeat all week 🎧", "drop your current top song, i need new music", "went to a concert last night and my voice is gone lol", "hot take: the b-sides are better than the singles", "making a collab playlist, add your songs 🎶", "learning guitar, my fingers hurt so much"],
    bios: ["Playlist curator • Vinyl collector", "Concert every weekend", "If it has bass, I'm there"], badges: [],
  },
  {
    key: "foodie", label: "Foodie", interests: ["food", "cooking", "baking"], emojiRate: 0.7, lowercase: false,
    slang: ["yum", "honestly", "chef's kiss"], emojis: ["🍕", "🍜", "🧁", "😋", "🌮"],
    openers: ["Made homemade ramen tonight and it slapped 🍜", "Pineapple on pizza: yes or no?", "Best late-night snack, go.", "I tried baking croissants... they're more like crois-can'ts 😭", "Taco Tuesday is a lifestyle 🌮", "Recipe swap anyone?"],
    bios: ["Home cook • Snack enthusiast", "Will travel for dumplings", "Baking my way through life"], badges: [],
  },
  {
    key: "athlete", label: "Athlete", interests: ["sports", "fitness", "running"], emojiRate: 0.5, lowercase: false,
    slang: ["let's go", "no days off", "fr"], emojis: ["🏀", "💪", "⚽", "🏃", "🔥"],
    openers: ["Did anyone catch the game last night?! 🏀", "New PR on deadlift today 💪", "Morning run done, 5k before breakfast", "Who's your MVP pick this season?", "Leg day tomorrow. Pray for me.", "Pickup soccer Saturday, who's in? ⚽"],
    bios: ["Varsity hooper", "Marathon in training", "Gym. Eat. Sleep. Repeat."], badges: [],
  },
  {
    key: "bookworm", label: "Bookworm", interests: ["books", "reading", "writing"], emojiRate: 0.3, lowercase: false,
    slang: ["genuinely", "honestly", "oh my"], emojis: ["📖", "☕", "✨", "🌙"],
    openers: ["Just finished a book that destroyed me emotionally 📖", "What's everyone reading right now?", "Physical books or e-readers? Discuss.", "Started writing my own short story!", "Book club pick for next month, any ideas?", "The movie was NOT better than the book."],
    bios: ["Reading 52 books this year", "Fantasy & sci-fi devourer", "Aspiring novelist"], badges: [],
  },
  {
    key: "memer", label: "Memer", interests: ["memes", "jokes", "internet"], emojiRate: 0.8, lowercase: true,
    slang: ["lmao", "bruh", "deadass", "its giving"], emojis: ["💀", "😂", "🐸", "🤡", "😭"],
    openers: ["why does my cat stare at walls like it sees the matrix 💀", "me pretending to understand the group project 🤡", "certified bruh moment just happened", "posting in #memes in 5 brace yourselves", "my sleep schedule is a work of abstract art", "it's giving main character energy"],
    bios: ["Professional shitposter (PG edition)", "Meme curator since 2016", "lmao"], badges: [],
  },
  {
    key: "traveler", label: "Traveler", interests: ["travel", "photography", "nature"], emojiRate: 0.5, lowercase: false,
    slang: ["wow", "honestly", "bucket list"], emojis: ["✈️", "🌍", "📸", "🏔️", "🌊"],
    openers: ["Just landed in Tokyo and everything is amazing ✈️", "Mountains or beaches? I'm team mountains 🏔️", "Sharing some sunset shots later 📸", "What's on your travel bucket list?", "Packing hacks anyone?", "Found the coziest café in Lisbon"],
    bios: ["32 countries and counting", "Film photographer", "Passport always ready"], badges: [],
  },
  {
    key: "scientist", label: "Science Nerd", interests: ["science", "space", "physics"], emojiRate: 0.4, lowercase: false,
    slang: ["fascinating", "technically", "fun fact"], emojis: ["🔬", "🚀", "🪐", "🧪", "🌌"],
    openers: ["Fun fact: octopuses have three hearts 🐙", "The James Webb images this week are unreal 🌌", "Anyone else think about black holes at 3am?", "Lab results came back and they're... interesting 🧪", "Technically we're all made of star stuff", "What's the coolest science fact you know?"],
    bios: ["Astrophysics student • Stargazer", "Lab coat enthusiast", "Ask me about quantum stuff"], badges: ["helper"],
  },
  {
    key: "chill", label: "Chill", interests: ["movies", "anime", "vibes"], emojiRate: 0.4, lowercase: true,
    slang: ["vibes", "same", "mood", "fair"], emojis: ["😌", "🍿", "🌙", "✌️"],
    openers: ["movie night recs? i'm in the mood for something cozy 🍿", "just vibing tbh", "rewatching my comfort anime for the 5th time", "rainy day mood 🌧️", "who else is staying up way too late", "currently: blanket, tea, no plans 😌"],
    bios: ["Anime & tea", "Professional napper", "Good vibes only ✌️"], badges: [],
  },
];

const FIRST = ["Ava", "Liam", "Maya", "Noah", "Zara", "Ethan", "Priya", "Leo", "Chloe", "Kai", "Sofia", "Mateo", "Aria", "Jayden", "Nina", "Omar", "Isla", "Ravi", "Luna", "Diego", "Hana", "Felix", "Amara", "Theo", "Mei", "Jonah", "Elena", "Arjun", "Ruby", "Malik", "Yuki", "Sam", "Ivy", "Marcus", "Layla", "Owen", "Sana", "Lucas", "Nadia", "Finn", "Aisha", "Hugo", "Freya", "Dev", "Camila", "Rowan", "Lena", "Tariq", "Jade", "Elijah", "Mila", "Kofi", "Bea", "Andre", "Tess", "Rio"];
const LAST = ["Chen", "Patel", "Kim", "Garcia", "Nguyen", "Okafor", "Silva", "Novak", "Haddad", "Rossi", "Tanaka", "Ivanova", "Mensah", "Larsen", "Costa", "Reyes", "Singh", "Müller", "Dubois", "Park", "Ali", "Moreau", "Sato", "Wright", "Adeyemi", "Kowalski"];
const COLORS = ["#7c5cff", "#22d3ee", "#f43f5e", "#f59e0b", "#10b981", "#ec4899", "#6366f1", "#14b8a6", "#ef4444", "#8b5cf6", "#0ea5e9", "#84cc16", "#f97316", "#a855f7", "#06b6d4", "#e11d48"];
const PRONOUNS = ["she/her", "he/him", "they/them", undefined, undefined];
const STATUSES = ["🎧 listening to lofi", "📚 studying", "🎮 in a match", "☕ coffee break", "🌙 up late", "✈️ traveling", "💻 shipping code", undefined, undefined, undefined];
const LANGS = ["en", "en", "en", "es", "fr", "de", "pt", "ja", "hi"];

export const BOT_COUNT = 56;

export function generateBots(count = BOT_COUNT, now = Date.now()): User[] {
  const rnd = seeded(2024);
  const p = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = p(LAST);
    const persona = PERSONAS[i % PERSONAS.length];
    const statusRoll = rnd();
    const status: Presence = statusRoll < 0.45 ? "online" : statusRoll < 0.6 ? "idle" : statusRoll < 0.68 ? "dnd" : "offline";
    const xp = Math.floor(rnd() * 12000);
    return {
      id: `bot_${i}`,
      username: `${first.toLowerCase()}${last.toLowerCase().replace(/[^a-z]/g, "")}${Math.floor(rnd() * 90 + 10)}`,
      displayName: `${first} ${last}`,
      avatarColor: COLORS[i % COLORS.length],
      bannerColor: COLORS[(i + 5) % COLORS.length],
      bio: p(persona.bios),
      pronouns: p(PRONOUNS),
      customStatus: p(STATUSES),
      status,
      lastSeen: now - Math.floor(rnd() * 86_400_000 * 3),
      isBot: true,
      persona: persona.key,
      interests: persona.interests,
      badges: [...persona.badges, ...(rnd() < 0.25 ? ["early"] : []), ...(rnd() < 0.1 ? ["verified"] : [])],
      xp,
      reputation: Math.floor(rnd() * 900),
      joinedAt: now - Math.floor(rnd() * 86_400_000 * 400) - 86_400_000,
      language: p(LANGS),
    } satisfies User;
  });
}

export const ASSISTANT_ID = "bot_nova";

export function assistantUser(now = Date.now()): User {
  return {
    id: ASSISTANT_ID,
    username: "nova",
    displayName: "Nova AI",
    avatarColor: "#7c5cff",
    bannerColor: "#22d3ee",
    bio: "Your friendly Pulse assistant. Ask me anything, or type /help. Connect a Claude API key in Settings → AI for smarter answers.",
    customStatus: "✨ here to help",
    status: "online",
    lastSeen: now,
    isBot: true,
    persona: "assistant",
    interests: ["help"],
    badges: ["bot", "verified", "staff"],
    xp: 99999,
    reputation: 1000,
    joinedAt: now - 86_400_000 * 500,
  };
}

export const personaFor = (key?: string) => PERSONAS.find((p) => p.key === key) ?? PERSONAS[PERSONAS.length - 1];
