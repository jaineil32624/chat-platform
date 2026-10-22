import type {
  Account, Channel, FriendState, ID, Message, ModerationAction, Notification, Presence, Report,
  ScheduledMessage, Server, Stroke, TransportEvent, User,
} from "../types";

// The shared, persisted "database". Every mutation is expressed as a
// TransportEvent and applied by `applyEvent`, so local actions, other tabs and
// the Socket.IO relay all converge on identical state.

export interface UserStats {
  messages: number;
  reactions: number;
  achievements: string[];
  streak: number;
  lastLoginDay?: string;
  daily: Record<string, number>;
}

export interface DB {
  version: number;
  users: Record<ID, User>;
  accounts: Record<string, Account>; // by lowercase email
  servers: Record<ID, Server>;
  channels: Record<ID, Channel>;
  messages: Record<ID, Message[]>; // by channel
  friends: Record<ID, Record<ID, FriendState>>;
  readState: Record<ID, Record<ID, number>>; // user -> channel -> last read ts
  notifications: Record<ID, Notification[]>;
  moderation: ModerationAction[];
  mutes: Record<ID, number>; // userId -> expiresAt
  bans: Record<ID, string>; // userId -> reason
  reports: Report[];
  stats: Record<ID, UserStats>;
  saved: Record<ID, string[]>; // userId -> `${channelId}::${messageId}`
  scheduled: (ScheduledMessage & { authorId: ID })[];
  whiteboards: Record<ID, Stroke[]>;
}

export const MAX_MESSAGES_PER_CHANNEL = 400;

export const emptyDB = (): DB => ({
  version: 1, users: {}, accounts: {}, servers: {}, channels: {}, messages: {}, friends: {}, readState: {},
  notifications: {}, moderation: [], mutes: {}, bans: {}, reports: [], stats: {}, saved: {}, scheduled: [], whiteboards: {},
});

export type EventPayloads = {
  "message:new": { message: Message };
  "message:update": { channelId: ID; id: ID; patch: Partial<Message> };
  "message:delete": { channelId: ID; id: ID; hard?: boolean };
  "reaction:toggle": { channelId: ID; id: ID; emoji: string; userId: ID; on?: boolean };
  typing: { channelId: ID; userId: ID; active: boolean };
  presence: { userId: ID; status: Presence; lastSeen: number };
  "channel:upsert": { channel: Channel; remove?: boolean };
  "server:upsert": { server: Server; remove?: boolean };
  "user:upsert": { user: User; account?: Account };
  "friend:update": { from: ID; to: ID; state: FriendState | "none" };
  moderation: { action: ModerationAction };
  "poll:vote": { channelId: ID; id: ID; optionId: string; userId: ID };
  "whiteboard:stroke": { channelId: ID; stroke: Stroke };
  "whiteboard:clear": { channelId: ID };
};

const mirror: Record<FriendState, FriendState> = { friends: "friends", outgoing: "incoming", incoming: "outgoing", blocked: "blocked" };

function patchMessage(db: DB, channelId: ID, id: ID, fn: (m: Message) => Message): DB {
  const list = db.messages[channelId];
  if (!list) return db;
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return db;
  const next = list.slice();
  next[idx] = fn(list[idx]);
  return { ...db, messages: { ...db.messages, [channelId]: next } };
}

/** Pure reducer: returns a new DB (structural sharing) or the same DB if no-op. */
export function applyEvent(db: DB, ev: Pick<TransportEvent, "type" | "payload">): DB {
  switch (ev.type) {
    case "message:new": {
      const { message } = ev.payload as EventPayloads["message:new"];
      const list = db.messages[message.channelId] ?? [];
      if (list.some((m) => m.id === message.id)) return db;
      let next = [...list, message];
      // keep chronological order even if events arrive out of order
      if (list.length && list[list.length - 1].createdAt > message.createdAt) next.sort((a, b) => a.createdAt - b.createdAt);
      if (next.length > MAX_MESSAGES_PER_CHANNEL) next = next.slice(-MAX_MESSAGES_PER_CHANNEL);
      return { ...db, messages: { ...db.messages, [message.channelId]: next } };
    }
    case "message:update": {
      const { channelId, id, patch } = ev.payload as EventPayloads["message:update"];
      return patchMessage(db, channelId, id, (m) => {
        // statuses only ever move forward
        const order = ["failed", "sending", "sent", "delivered", "read"];
        const status = patch.status && order.indexOf(patch.status) < order.indexOf(m.status) ? m.status : patch.status ?? m.status;
        const readBy = patch.readBy ? [...new Set([...(m.readBy ?? []), ...patch.readBy])] : m.readBy;
        return { ...m, ...patch, status, readBy };
      });
    }
    case "message:delete": {
      const { channelId, id, hard } = ev.payload as EventPayloads["message:delete"];
      if (hard) {
        const list = db.messages[channelId];
        if (!list) return db;
        return { ...db, messages: { ...db.messages, [channelId]: list.filter((m) => m.id !== id) } };
      }
      return patchMessage(db, channelId, id, (m) => ({ ...m, deletedAt: Date.now(), content: "", attachments: [], reactions: {}, poll: undefined, gif: undefined }));
    }
    case "reaction:toggle": {
      const { channelId, id, emoji, userId, on } = ev.payload as EventPayloads["reaction:toggle"];
      return patchMessage(db, channelId, id, (m) => {
        const reactions = { ...(m.reactions ?? {}) };
        const users = reactions[emoji] ?? [];
        const has = users.includes(userId);
        const want = on ?? !has;
        if (want === has) return m;
        reactions[emoji] = want ? [...users, userId] : users.filter((u) => u !== userId);
        if (!reactions[emoji].length) delete reactions[emoji];
        return { ...m, reactions };
      });
    }
    case "poll:vote": {
      const { channelId, id, optionId, userId } = ev.payload as EventPayloads["poll:vote"];
      return patchMessage(db, channelId, id, (m) => {
        if (!m.poll) return m;
        const options = m.poll.options.map((o) => {
          const voted = o.votes.includes(userId);
          if (o.id === optionId) return { ...o, votes: voted ? o.votes.filter((v) => v !== userId) : [...o.votes, userId] };
          return m.poll!.multi ? o : { ...o, votes: o.votes.filter((v) => v !== userId) };
        });
        return { ...m, poll: { ...m.poll, options } };
      });
    }
    case "presence": {
      const { userId, status, lastSeen } = ev.payload as EventPayloads["presence"];
      const u = db.users[userId];
      if (!u || (u.status === status && u.lastSeen === lastSeen)) return db;
      return { ...db, users: { ...db.users, [userId]: { ...u, status, lastSeen } } };
    }
    case "user:upsert": {
      const { user, account } = ev.payload as EventPayloads["user:upsert"];
      const users = { ...db.users, [user.id]: { ...db.users[user.id], ...user } };
      const accounts = account ? { ...db.accounts, [account.email.toLowerCase()]: account } : db.accounts;
      return { ...db, users, accounts };
    }
    case "channel:upsert": {
      const { channel, remove } = ev.payload as EventPayloads["channel:upsert"];
      const channels = { ...db.channels };
      if (remove) delete channels[channel.id];
      else channels[channel.id] = { ...channels[channel.id], ...channel };
      const messages = remove || db.messages[channel.id] ? db.messages : { ...db.messages, [channel.id]: [] };
      return { ...db, channels, messages };
    }
    case "server:upsert": {
      const { server, remove } = ev.payload as EventPayloads["server:upsert"];
      const servers = { ...db.servers };
      if (remove) delete servers[server.id];
      else servers[server.id] = server;
      return { ...db, servers };
    }
    case "friend:update": {
      const { from, to, state } = ev.payload as EventPayloads["friend:update"];
      const a = { ...(db.friends[from] ?? {}) };
      const b = { ...(db.friends[to] ?? {}) };
      if (state === "none") {
        delete a[to];
        delete b[from];
      } else if (state === "blocked") {
        a[to] = "blocked";
        if (b[from] !== "blocked") delete b[from];
      } else {
        a[to] = state;
        b[from] = mirror[state];
      }
      return { ...db, friends: { ...db.friends, [from]: a, [to]: b } };
    }
    case "moderation": {
      const { action } = ev.payload as EventPayloads["moderation"];
      if (db.moderation.some((m) => m.id === action.id)) return db;
      const mutes = { ...db.mutes };
      const bans = { ...db.bans };
      if (action.kind === "mute") mutes[action.userId] = action.expiresAt ?? Number.MAX_SAFE_INTEGER;
      if (action.kind === "unmute") delete mutes[action.userId];
      if (action.kind === "ban") bans[action.userId] = action.reason;
      if (action.kind === "unban") delete bans[action.userId];
      return { ...db, mutes, bans, moderation: [action, ...db.moderation].slice(0, 500) };
    }
    case "whiteboard:stroke": {
      const { channelId, stroke } = ev.payload as EventPayloads["whiteboard:stroke"];
      const list = db.whiteboards[channelId] ?? [];
      if (list.some((s) => s.id === stroke.id)) return db;
      return { ...db, whiteboards: { ...db.whiteboards, [channelId]: [...list, stroke].slice(-800) } };
    }
    case "whiteboard:clear": {
      const { channelId } = ev.payload as EventPayloads["whiteboard:clear"];
      return { ...db, whiteboards: { ...db.whiteboards, [channelId]: [] } };
    }
    case "typing":
    default:
      return db; // typing is ephemeral — handled outside the DB
  }
}

/** DM channel id is stable for a pair of users so both sides find the same conversation. */
export const dmChannelId = (a: ID, b: ID) => `dm:${[a, b].sort().join(":")}`;

export function isMuted(db: DB, userId: ID, now = Date.now()): boolean {
  const exp = db.mutes[userId];
  return exp !== undefined && exp > now;
}

export function unreadCount(db: DB, userId: ID, channelId: ID): number {
  const last = db.readState[userId]?.[channelId] ?? 0;
  const list = db.messages[channelId] ?? [];
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i].createdAt > last; i--) if (list[i].authorId !== userId && !list[i].deletedAt) n++;
  return n;
}

export function searchMessages(db: DB, query: string, opts: { channelIds?: ID[]; authorId?: ID; has?: "image" | "link" | "file"; limit?: number } = {}) {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const results: Message[] = [];
  const channelIds = opts.channelIds ?? Object.keys(db.messages);
  for (const cid of channelIds) {
    for (const m of db.messages[cid] ?? []) {
      if (m.deletedAt) continue;
      if (opts.authorId && m.authorId !== opts.authorId) continue;
      if (opts.has === "image" && !m.attachments?.some((a) => a.kind === "image")) continue;
      if (opts.has === "file" && !m.attachments?.some((a) => a.kind === "file")) continue;
      if (opts.has === "link" && !/https?:\/\//.test(m.content)) continue;
      const hay = `${m.content} ${m.attachments?.map((a) => a.name).join(" ") ?? ""} ${m.poll?.question ?? ""}`.toLowerCase();
      if (terms.every((t) => hay.includes(t))) results.push(m);
    }
  }
  return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, opts.limit ?? 100);
}
