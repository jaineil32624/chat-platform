// Core domain model for Pulse. Mirrors database/schema.sql so the mock
// backend can be swapped for Supabase without touching UI code.

export type ID = string;
export type Presence = "online" | "idle" | "dnd" | "offline";
export type ThemeMode = "dark" | "light" | "system";

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface User {
  id: ID;
  username: string;
  displayName: string;
  avatarColor: string; // hex
  avatarUrl?: string; // data URL for uploaded avatars
  bannerColor: string;
  bio: string;
  pronouns?: string;
  customStatus?: string;
  status: Presence;
  lastSeen: number;
  isBot: boolean;
  persona?: string; // bot personality key
  interests?: string[];
  badges: string[]; // Badge ids
  xp: number;
  reputation: number;
  joinedAt: number;
  timezone?: string;
  language?: string;
}

export interface Account {
  userId: ID;
  email: string;
  passwordHash: string; // SHA-256(salt + password) — simulation only
  salt: string;
  createdAt: number;
  isAdmin: boolean;
}

export type ChannelKind = "dm" | "group-dm" | "text" | "voice" | "announcement";

export interface Channel {
  id: ID;
  kind: ChannelKind;
  name: string;
  topic?: string;
  serverId?: ID;
  categoryId?: ID;
  memberIds?: ID[]; // for DMs / group DMs
  createdAt: number;
  slowmode?: number;
  encrypted?: boolean;
  icon?: string;
}

export interface Category {
  id: ID;
  name: string;
  collapsed?: boolean;
}

export interface Role {
  id: ID;
  name: string;
  color: string;
  permissions: number; // bitfield, see lib/permissions.ts
  position: number;
  hoist?: boolean;
}

export interface Server {
  id: ID;
  name: string;
  icon: string; // emoji
  color: string;
  description: string;
  ownerId: ID;
  memberIds: ID[];
  roles: Role[];
  memberRoles: Record<ID, ID[]>;
  categories: Category[];
  channelIds: ID[];
  isPublic: boolean;
  tags: string[];
  createdAt: number;
  banner?: string;
  customEmojis?: CustomEmoji[];
}

export interface CustomEmoji {
  id: ID;
  name: string;
  glyph: string; // rendered emoji/glyph or data url
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type MessageKind = "text" | "gif" | "sticker" | "voice" | "poll" | "trivia" | "system" | "image" | "file" | "call";

export interface Attachment {
  id: ID;
  kind: "image" | "file" | "audio";
  name: string;
  size: number;
  mime: string;
  url: string; // data URL or remote
  width?: number;
  height?: number;
  durationMs?: number;
  waveform?: number[];
}

export interface Poll {
  question: string;
  options: { id: string; label: string; votes: ID[] }[];
  multi: boolean;
  closesAt?: number;
}

export interface Trivia {
  question: string;
  choices: string[];
  answer: number;
  answeredBy: Record<ID, number>;
  winnerId?: ID;
  category: string;
}

export interface Message {
  id: ID;
  channelId: ID;
  authorId: ID;
  kind: MessageKind;
  content: string;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
  status: MessageStatus;
  readBy?: ID[];
  attachments?: Attachment[];
  reactions?: Record<string, ID[]>;
  replyToId?: ID;
  threadParentId?: ID;
  pinned?: boolean;
  gif?: { id: string; title: string; url?: string; emoji?: string; gradient?: string };
  sticker?: string;
  poll?: Poll;
  trivia?: Trivia;
  translated?: Record<string, string>;
  ciphertext?: string;
  mentions?: ID[];
}

export interface ScheduledMessage {
  id: ID;
  channelId: ID;
  content: string;
  sendAt: number;
}

export type FriendState = "friends" | "outgoing" | "incoming" | "blocked";

export interface Notification {
  id: ID;
  title: string;
  body: string;
  channelId?: ID;
  icon?: string;
  createdAt: number;
  read: boolean;
  kind: "message" | "mention" | "friend" | "achievement" | "system" | "level";
}

export interface ModerationAction {
  id: ID;
  userId: ID;
  moderatorId: ID;
  kind: "mute" | "ban" | "warn" | "unmute" | "unban" | "delete";
  reason: string;
  createdAt: number;
  expiresAt?: number;
  serverId?: ID;
}

export interface Report {
  id: ID;
  messageId: ID;
  reporterId: ID;
  reason: string;
  createdAt: number;
  resolved: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  xp: number;
}

export interface Stroke {
  id: ID;
  userId: ID;
  color: string;
  width: number;
  points: [number, number][];
}

export interface ThemePrefs {
  mode: ThemeMode;
  accent: string; // hex
  accent2: string;
  density: "cozy" | "compact";
  glass: boolean;
  fontScale: number;
  reducedMotion: boolean;
  wallpaper: "aurora" | "mesh" | "none" | "grid";
}

export interface CallState {
  channelId: ID;
  kind: "voice" | "video";
  startedAt: number;
  participants: ID[];
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screen: boolean;
  speakingId?: ID;
}

export type TransportEventType =
  | "message:new"
  | "message:update"
  | "message:delete"
  | "reaction:toggle"
  | "typing"
  | "presence"
  | "channel:upsert"
  | "server:upsert"
  | "user:upsert"
  | "friend:update"
  | "moderation"
  | "poll:vote"
  | "whiteboard:stroke"
  | "whiteboard:clear";

export interface TransportEvent<T = unknown> {
  id: string;
  type: TransportEventType;
  payload: T;
  origin: string;
  ts: number;
  workspace?: string;
}
