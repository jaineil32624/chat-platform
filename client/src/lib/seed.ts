import type { Category, Channel, Message, Role, Server, User } from "./types";
import { DEFAULT_MEMBER, MODERATOR, ALL_PERMS } from "./permissions";
import { ASSISTANT_ID, assistantUser, generateBots, PERSONAS, personaFor } from "./sim/personas";
import { generateReply, voice } from "./sim/replies";
import { BUILTIN_GIFS } from "./content";
import { seeded } from "./utils";

interface ChannelSpec {
  name: string;
  kind?: Channel["kind"];
  topic?: string;
  category: string;
}

interface ServerSpec {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  tags: string[];
  personas: string[]; // which personas tend to join
  joined: boolean; // whether the new user is auto-joined
  channels: ChannelSpec[];
  banner?: string;
}

export const SERVER_SPECS: ServerSpec[] = [
  {
    id: "srv_hq", name: "Pulse HQ", icon: "💜", color: "#7c5cff", joined: true,
    description: "The official Pulse community — announcements, feedback, and hanging out.",
    tags: ["official", "community"], personas: PERSONAS.map((p) => p.key),
    channels: [
      { name: "welcome", category: "Info", kind: "announcement", topic: "Start here! Read the rules and say hi 👋" },
      { name: "announcements", category: "Info", kind: "announcement", topic: "Product updates and events" },
      { name: "general", category: "Community", topic: "Talk about anything" },
      { name: "introductions", category: "Community", topic: "Tell us about yourself" },
      { name: "memes", category: "Community", topic: "Keep it wholesome 🐸" },
      { name: "feedback", category: "Community", topic: "Ideas & bug reports for Pulse" },
      { name: "Lounge", category: "Voice", kind: "voice" },
      { name: "Stage", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_gaming", name: "Gaming Guild", icon: "🎮", color: "#f43f5e", joined: true,
    description: "LFG, clips, patch notes and friendly competition.",
    tags: ["gaming", "esports", "lfg"], personas: ["gamer", "memer", "chill", "dev"],
    channels: [
      { name: "general", category: "Text", topic: "GGs only" },
      { name: "looking-for-group", category: "Text", topic: "Find a squad" },
      { name: "clips-and-highlights", category: "Text", topic: "Show off your plays" },
      { name: "patch-notes", category: "Text", topic: "Buffs, nerfs, and tears" },
      { name: "Squad 1", category: "Voice", kind: "voice" },
      { name: "Squad 2", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_study", name: "Study Hall", icon: "📚", color: "#10b981", joined: true,
    description: "Homework help, focus sessions, and exam survival.",
    tags: ["education", "study", "homework"], personas: ["student", "scientist", "bookworm", "dev"],
    channels: [
      { name: "general", category: "Study", topic: "Study buddies unite" },
      { name: "homework-help", category: "Study", topic: "Ask questions, get answers" },
      { name: "resources", category: "Study", topic: "Share notes and links" },
      { name: "wins", category: "Study", topic: "Celebrate your grades 🎉" },
      { name: "Focus Room", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_dev", name: "Dev Den", icon: "💻", color: "#0ea5e9", joined: true,
    description: "Builders, hackers and makers shipping side projects.",
    tags: ["programming", "tech", "open source"], personas: ["dev", "scientist", "gamer", "student"],
    channels: [
      { name: "general", category: "Chat", topic: "Talk shop" },
      { name: "show-and-tell", category: "Chat", topic: "Ship it and share it 🚀" },
      { name: "help", category: "Chat", topic: "Stuck? Ask here" },
      { name: "hackathons", category: "Chat", topic: "Teams, ideas & deadlines" },
      { name: "Pair Programming", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_art", name: "Art Collective", icon: "🎨", color: "#ec4899", joined: true,
    description: "Share your art, get feedback, find inspiration.",
    tags: ["art", "design", "creative"], personas: ["artist", "music", "traveler", "chill"],
    channels: [
      { name: "showcase", category: "Gallery", topic: "Your best work" },
      { name: "critique", category: "Gallery", topic: "Kind, constructive feedback" },
      { name: "inspiration", category: "Gallery", topic: "References and mood boards" },
      { name: "Draw Together", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_music", name: "Music Lounge", icon: "🎧", color: "#f59e0b", joined: false,
    description: "Playlists, concerts, and discovering new sounds.",
    tags: ["music", "playlists"], personas: ["music", "chill", "artist"],
    channels: [
      { name: "general", category: "Text", topic: "What are you listening to?" },
      { name: "recommendations", category: "Text", topic: "Drop your favorites" },
      { name: "Listening Party", category: "Voice", kind: "voice" },
    ],
  },
  {
    id: "srv_food", name: "Foodies United", icon: "🍜", color: "#f97316", joined: false,
    description: "Recipes, restaurant reviews and late-night snack debates.",
    tags: ["food", "cooking"], personas: ["foodie", "traveler", "chill"],
    channels: [
      { name: "general", category: "Kitchen", topic: "Hungry yet?" },
      { name: "recipes", category: "Kitchen", topic: "Share what you cook" },
    ],
  },
  {
    id: "srv_space", name: "Space & Science", icon: "🪐", color: "#6366f1", joined: false,
    description: "Astronomy, physics, and mind-blowing facts.",
    tags: ["science", "space", "education"], personas: ["scientist", "student", "bookworm"],
    channels: [
      { name: "general", category: "Lab", topic: "Fascinating stuff only" },
      { name: "astronomy", category: "Lab", topic: "Look up 🌌" },
    ],
  },
  {
    id: "srv_fit", name: "Fitness Squad", icon: "💪", color: "#84cc16", joined: false,
    description: "Workouts, PRs, and accountability partners.",
    tags: ["fitness", "sports"], personas: ["athlete", "foodie"],
    channels: [
      { name: "general", category: "Gym", topic: "No days off" },
      { name: "progress", category: "Gym", topic: "Post your wins" },
    ],
  },
  {
    id: "srv_books", name: "Book Nook", icon: "📖", color: "#a855f7", joined: false,
    description: "A cozy corner for readers and writers.",
    tags: ["books", "writing"], personas: ["bookworm", "student", "chill"],
    channels: [
      { name: "general", category: "Shelves", topic: "Currently reading…" },
      { name: "writing-room", category: "Shelves", topic: "Share your drafts" },
    ],
  },
  {
    id: "srv_travel", name: "Wanderlust", icon: "✈️", color: "#14b8a6", joined: false,
    description: "Travel stories, tips and photography.",
    tags: ["travel", "photography"], personas: ["traveler", "artist", "foodie"],
    channels: [
      { name: "general", category: "Lobby", topic: "Where to next?" },
      { name: "photo-wall", category: "Lobby", topic: "Your best shots" },
    ],
  },
];

export interface SeedResult {
  users: Record<string, User>;
  servers: Record<string, Server>;
  channels: Record<string, Channel>;
  messages: Record<string, Message[]>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function buildSeed(now = Date.now()): SeedResult {
  const rnd = seeded(42);
  const pickR = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const bots = generateBots(undefined, now);
  const nova = assistantUser(now);
  const users: Record<string, User> = Object.fromEntries([...bots, nova].map((u) => [u.id, u]));
  const servers: Record<string, Server> = {};
  const channels: Record<string, Channel> = {};
  const messages: Record<string, Message[]> = {};

  for (const spec of SERVER_SPECS) {
    const pool = bots.filter((b) => spec.personas.includes(b.persona!));
    const members = pool.filter(() => rnd() < (spec.id === "srv_hq" ? 0.95 : 0.8)).map((b) => b.id);
    const owner = members[0] ?? bots[0].id;
    const roles: Role[] = [
      { id: `${spec.id}:everyone`, name: "@everyone", color: "#94a3b8", permissions: DEFAULT_MEMBER, position: 0 },
      { id: `${spec.id}:member`, name: "Member", color: "#60a5fa", permissions: DEFAULT_MEMBER, position: 1 },
      { id: `${spec.id}:mod`, name: "Moderator", color: "#34d399", permissions: MODERATOR, position: 2, hoist: true },
      { id: `${spec.id}:admin`, name: "Admin", color: "#f472b6", permissions: ALL_PERMS, position: 3, hoist: true },
    ];
    const memberRoles: Record<string, string[]> = {};
    members.forEach((m, i) => {
      memberRoles[m] = [`${spec.id}:member`];
      if (i > 0 && i < 3) memberRoles[m].push(`${spec.id}:mod`);
      if (i === 0) memberRoles[m].push(`${spec.id}:admin`);
    });
    if (spec.id === "srv_hq") {
      members.unshift(ASSISTANT_ID);
      memberRoles[ASSISTANT_ID] = [`${spec.id}:admin`];
    }
    const categoryNames = [...new Set(spec.channels.map((c) => c.category))];
    const categories: Category[] = categoryNames.map((n) => ({ id: `${spec.id}:cat:${slug(n)}`, name: n }));
    const channelIds: string[] = [];

    for (const cs of spec.channels) {
      const id = `${spec.id}:${slug(cs.name)}`;
      channelIds.push(id);
      channels[id] = {
        id, kind: cs.kind ?? "text", name: cs.kind === "voice" ? cs.name : slug(cs.name), topic: cs.topic,
        serverId: spec.id, categoryId: `${spec.id}:cat:${slug(cs.category)}`, createdAt: now - 86_400_000 * 90,
      };
      if (cs.kind === "voice") continue;
      messages[id] = seedHistory(id, cs.name, members.filter((m) => m !== ASSISTANT_ID), users, now, rnd, pickR, spec.id === "srv_hq" && cs.name === "welcome");
    }

    servers[spec.id] = {
      id: spec.id, name: spec.name, icon: spec.icon, color: spec.color, description: spec.description,
      ownerId: spec.id === "srv_hq" ? ASSISTANT_ID : owner, memberIds: members, roles, memberRoles, categories, channelIds,
      isPublic: true, tags: spec.tags, createdAt: now - 86_400_000 * 120,
      customEmojis: spec.id === "srv_hq" ? [
        { id: "e1", name: "pulse", glyph: "💜" }, { id: "e2", name: "partyparrot", glyph: "🦜" }, { id: "e3", name: "shipit", glyph: "🚢" },
      ] : [],
    };
  }

  return { users, servers, channels, messages };
}

function seedHistory(
  channelId: string,
  channelName: string,
  members: string[],
  users: Record<string, User>,
  now: number,
  rnd: () => number,
  pickR: <T>(a: readonly T[]) => T,
  isWelcome: boolean,
): Message[] {
  const out: Message[] = [];
  if (isWelcome) {
    out.push({
      id: `${channelId}:m0`, channelId, authorId: ASSISTANT_ID, kind: "text", status: "read", pinned: true,
      createdAt: now - 86_400_000 * 30,
      content: "# Welcome to **Pulse** 💜\nThis is a fully simulated community — every user here is an AI-driven bot with their own personality, presence, and opinions.\n\n**Try things out:**\n• Say hi in #general and watch people respond\n• DM anyone from the member list\n• Type `/poll`, `/trivia`, or ask **@Nova AI** for help\n• Open **Settings** to customize your theme\n\nBe kind, have fun, and earn XP as you chat! ⭐",
      reactions: { "💜": members.slice(0, 18), "🎉": members.slice(3, 11), "👋": members.slice(5, 20) },
    });
    return out;
  }
  const count = 14 + Math.floor(rnd() * 16);
  let t = now - 86_400_000 * 2 - Math.floor(rnd() * 3_600_000);
  let prev = "";
  for (let i = 0; i < count; i++) {
    const authorId = pickR(members);
    const author = users[authorId];
    const persona = personaFor(author?.persona);
    t += Math.floor(rnd() * 3_600_000 * 1.6) + 30_000;
    if (t > now - 60_000) break;
    const asReply = prev && rnd() < 0.55;
    const isGif = rnd() < 0.06;
    const content = asReply
      ? generateReply({ text: prev, authorName: "friend", botName: author.displayName, personaKey: persona.key })
      : voice(pickR(persona.openers), persona, rnd);
    const reactions: Record<string, string[]> = {};
    if (rnd() < 0.35) {
      const emoji = pickR(["👍", "😂", "🔥", "❤️", "💀", "👀", "💯", "🎉"]);
      reactions[emoji] = members.filter(() => rnd() < 0.12).slice(0, 9);
      if (!reactions[emoji].length) delete reactions[emoji];
    }
    const gif = isGif ? pickR(BUILTIN_GIFS) : undefined;
    out.push({
      id: `${channelId}:m${i}`, channelId, authorId, kind: gif ? "gif" : "text",
      content: gif ? gif.title : content, createdAt: t, status: "read",
      gif: gif ? { id: gif.id, title: gif.title, emoji: gif.emoji, gradient: gif.gradient } : undefined,
      reactions, pinned: i === 2 && channelName === "general",
    });
    prev = content;
  }
  return out;
}
