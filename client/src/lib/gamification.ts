import type { Achievement, Badge } from "./types";

// XP curve: level n requires 50·n² cumulative XP (fast early levels, long tail).
export const xpForLevel = (level: number) => 50 * level * level;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - base, needed: next - base, pct: (xp - base) / (next - base) };
}

export const REPUTATION_TIERS = [
  { min: 0, name: "Newcomer", color: "#94a3b8" },
  { min: 25, name: "Regular", color: "#22d3ee" },
  { min: 100, name: "Trusted", color: "#34d399" },
  { min: 300, name: "Veteran", color: "#a78bfa" },
  { min: 750, name: "Legend", color: "#fbbf24" },
] as const;

export function reputationTier(rep: number) {
  return [...REPUTATION_TIERS].reverse().find((t) => rep >= t.min) ?? REPUTATION_TIERS[0];
}

export const XP_REWARDS = {
  message: 5,
  reaction: 1,
  dailyLogin: 25,
  streakBonusPerDay: 5,
  pollCreated: 10,
  triviaWin: 30,
  friendAdded: 15,
  serverCreated: 40,
  voiceNote: 8,
  image: 6,
} as const;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-message", name: "Hello, World", description: "Send your first message", emoji: "👋", xp: 20 },
  { id: "msg-10", name: "Chatterbox", description: "Send 10 messages", emoji: "💬", xp: 30 },
  { id: "msg-100", name: "Conversationalist", description: "Send 100 messages", emoji: "🗣️", xp: 100 },
  { id: "msg-500", name: "Keyboard Warrior", description: "Send 500 messages", emoji: "⌨️", xp: 250 },
  { id: "first-reaction", name: "Reactor", description: "React to a message", emoji: "⚡", xp: 10 },
  { id: "first-friend", name: "Making Friends", description: "Add your first friend", emoji: "🤝", xp: 25 },
  { id: "social-5", name: "Social Butterfly", description: "Have 5 friends", emoji: "🦋", xp: 60 },
  { id: "server-owner", name: "Founder", description: "Create a server", emoji: "🏰", xp: 50 },
  { id: "pollster", name: "Pollster", description: "Create a poll", emoji: "📊", xp: 20 },
  { id: "trivia-win", name: "Big Brain", description: "Win a trivia round", emoji: "🧠", xp: 40 },
  { id: "artist", name: "Picasso", description: "Draw on the shared whiteboard", emoji: "🎨", xp: 20 },
  { id: "voice", name: "On Air", description: "Send a voice note", emoji: "🎙️", xp: 15 },
  { id: "photographer", name: "Shutterbug", description: "Share an image", emoji: "📸", xp: 15 },
  { id: "streak-3", name: "Warming Up", description: "3-day login streak", emoji: "🔥", xp: 30 },
  { id: "streak-7", name: "On Fire", description: "7-day login streak", emoji: "☄️", xp: 80 },
  { id: "night-owl", name: "Night Owl", description: "Send a message between 12am and 4am", emoji: "🦉", xp: 15 },
  { id: "level-5", name: "Rising Star", description: "Reach level 5", emoji: "⭐", xp: 0 },
  { id: "level-10", name: "Superstar", description: "Reach level 10", emoji: "🌟", xp: 0 },
  { id: "meme-lord", name: "Meme Lord", description: "Share a meme", emoji: "🐸", xp: 15 },
  { id: "caller", name: "Ring Ring", description: "Start a call", emoji: "📞", xp: 15 },
];

export const BADGES: Record<string, Badge> = {
  founder: { id: "founder", label: "Founder", emoji: "👑", description: "Created a community on Pulse" },
  early: { id: "early", label: "Early Adopter", emoji: "🌱", description: "Joined during the beta" },
  bot: { id: "bot", label: "Bot", emoji: "🤖", description: "Automated simulated user" },
  staff: { id: "staff", label: "Staff", emoji: "🛡️", description: "Pulse platform administrator" },
  verified: { id: "verified", label: "Verified", emoji: "✔️", description: "Verified identity" },
  artist: { id: "artist", label: "Artist", emoji: "🎨", description: "Creative contributor" },
  dev: { id: "dev", label: "Developer", emoji: "💻", description: "Builds things" },
  gamer: { id: "gamer", label: "Gamer", emoji: "🎮", description: "Always queued up" },
  helper: { id: "helper", label: "Helper", emoji: "💡", description: "Answers questions for others" },
  streak: { id: "streak", label: "On Fire", emoji: "🔥", description: "7+ day login streak" },
  bigbrain: { id: "bigbrain", label: "Trivia Champ", emoji: "🧠", description: "Won trivia" },
  supporter: { id: "supporter", label: "Supporter", emoji: "💜", description: "Pulse supporter" },
};

/** Pure check — returns ids of achievements newly satisfied by the given stats. */
export function evaluateAchievements(
  stats: { messages: number; friends: number; reactions: number; streak: number; level: number; hour?: number },
  unlocked: string[],
): string[] {
  const rules: [string, boolean][] = [
    ["first-message", stats.messages >= 1],
    ["msg-10", stats.messages >= 10],
    ["msg-100", stats.messages >= 100],
    ["msg-500", stats.messages >= 500],
    ["first-reaction", stats.reactions >= 1],
    ["first-friend", stats.friends >= 1],
    ["social-5", stats.friends >= 5],
    ["streak-3", stats.streak >= 3],
    ["streak-7", stats.streak >= 7],
    ["level-5", stats.level >= 5],
    ["level-10", stats.level >= 10],
    ["night-owl", stats.hour !== undefined && stats.hour >= 0 && stats.hour < 4 && stats.messages > 0],
  ];
  return rules.filter(([id, ok]) => ok && !unlocked.includes(id)).map(([id]) => id);
}

/** Streak update given last login day key (YYYY-MM-DD). */
export function nextStreak(lastDay: string | undefined, streak: number, today: string): { streak: number; isNewDay: boolean } {
  if (lastDay === today) return { streak, isNewDay: false };
  if (!lastDay) return { streak: 1, isNewDay: true };
  const diff = Math.round((Date.parse(today) - Date.parse(lastDay)) / 86_400_000);
  return { streak: diff === 1 ? streak + 1 : 1, isNewDay: true };
}

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
