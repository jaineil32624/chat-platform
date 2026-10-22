"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type {
  Attachment, CallState, Channel, ID, Message, ModerationAction, Notification, Poll, Presence, Server,
  ThemePrefs, Trivia, TransportEvent, TransportEventType, User,
} from "../types";
import { applyEvent, dmChannelId, emptyDB, isMuted, type DB, type EventPayloads } from "./reducer";
import { buildSeed } from "../seed";
import { getTransport } from "../transport";
import { uid, isBrowser } from "../utils";
import { hashPassword, randomSalt, encryptForChannel } from "../crypto";
import { ACHIEVEMENTS, BADGES, dayKey, evaluateAchievements, levelFromXp, nextStreak, XP_REWARDS } from "../gamification";
import { ASSISTANT_ID } from "../sim/personas";
import { DEFAULT_MEMBER, ALL_PERMS, MODERATOR } from "../permissions";
import { claudeAssistantReply, offlineAssistantReply } from "../sim/assistant";

export const SEED_VERSION = 3;
export const DEMO_EMAIL = "demo@pulse.chat";
export const DEMO_PASSWORD = "pulse-demo";

export type RightPanel = null | "members" | "thread" | "pins" | "search" | "saved" | "notifications";
export type ModalKind =
  | "createServer" | "settings" | "serverSettings" | "invite" | "createChannel" | "poll" | "whiteboard"
  | "schedule" | "encryption" | "shortcuts" | "meme" | "profile" | "achievements" | "newDm";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  icon?: string;
  tone?: "default" | "success" | "warn" | "danger" | "level";
  channelId?: ID;
}

export interface UIState {
  hydrated: boolean;
  sessionUserId?: ID;
  activeServerId: ID | "home";
  activeChannelId?: ID;
  homeView: "friends" | "discover" | "dm";
  rightPanel: RightPanel;
  threadParentId?: ID;
  replyToId?: ID;
  editingId?: ID;
  modal: null | { kind: ModalKind; props?: Record<string, unknown> };
  profileUserId?: ID;
  typing: Record<ID, Record<ID, number>>;
  toasts: Toast[];
  call?: CallState;
  mobileNav: boolean;
  theme: ThemePrefs;
  apiKey?: string;
  sounds: boolean;
  desktopNotifications: boolean;
  jumpToId?: ID;
  /** last-read timestamp of the active channel captured just before opening it */
  openedReadAt?: number;
}

export interface Actions {
  // infra
  dispatch: <T extends TransportEventType>(type: T, payload: T extends keyof EventPayloads ? EventPayloads[T] : unknown, opts?: { local?: boolean }) => void;
  receive: (ev: TransportEvent) => void;
  ensureSeed: () => void;
  resetDemo: () => void;
  // auth
  register: (p: { email: string; password: string; displayName: string; username: string; avatarColor: string }) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  // navigation
  openServer: (serverId: ID | "home") => void;
  openChannel: (channelId: ID) => void;
  openDm: (userId: ID) => void;
  setHomeView: (v: UIState["homeView"]) => void;
  setRightPanel: (p: RightPanel) => void;
  openThread: (messageId: ID) => void;
  setReplyTo: (id?: ID) => void;
  setEditing: (id?: ID) => void;
  openModal: (kind: ModalKind, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  showProfile: (userId?: ID) => void;
  setMobileNav: (v: boolean) => void;
  jumpTo: (channelId: ID, messageId: ID) => void;
  // messaging
  sendMessage: (channelId: ID, draft: Partial<Message> & { content: string }) => Promise<Message | undefined>;
  editMessage: (channelId: ID, id: ID, content: string) => void;
  deleteMessage: (channelId: ID, id: ID) => void;
  toggleReaction: (channelId: ID, id: ID, emoji: string) => void;
  votePoll: (channelId: ID, id: ID, optionId: string) => void;
  answerTrivia: (channelId: ID, id: ID, choice: number) => void;
  togglePin: (channelId: ID, id: ID) => void;
  toggleSave: (channelId: ID, id: ID) => void;
  reportMessage: (channelId: ID, id: ID, reason: string) => void;
  setTyping: (channelId: ID, active: boolean) => void;
  markRead: (channelId: ID) => void;
  scheduleMessage: (channelId: ID, content: string, sendAt: number) => void;
  cancelScheduled: (id: ID) => void;
  // social
  sendFriendRequest: (userId: ID) => void;
  respondFriend: (userId: ID, accept: boolean) => void;
  removeFriend: (userId: ID) => void;
  blockUser: (userId: ID) => void;
  updateProfile: (patch: Partial<User>) => void;
  setPresence: (status: Presence) => void;
  // servers
  createServer: (p: { name: string; icon: string; color: string; description: string; template: string; isPublic: boolean }) => ID;
  joinServer: (serverId: ID) => void;
  leaveServer: (serverId: ID) => void;
  updateServer: (server: Server) => void;
  createChannel: (serverId: ID, p: { name: string; kind: Channel["kind"]; categoryId?: ID; topic?: string }) => void;
  deleteChannel: (channelId: ID) => void;
  createGroupDm: (userIds: ID[], name?: string) => ID;
  // moderation
  moderate: (userId: ID, kind: ModerationAction["kind"], reason: string, durationMs?: number, serverId?: ID) => void;
  resolveReport: (id: ID) => void;
  // gamification & notifications
  awardXp: (amount: number, reason?: string) => void;
  unlock: (achievementId: string) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "read">) => void;
  markNotificationsRead: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  // whiteboard / calls
  addStroke: (channelId: ID, stroke: EventPayloads["whiteboard:stroke"]["stroke"]) => void;
  clearWhiteboard: (channelId: ID) => void;
  startCall: (channelId: ID, kind: "voice" | "video") => void;
  updateCall: (patch: Partial<CallState>) => void;
  endCall: () => void;
  // prefs
  setTheme: (patch: Partial<ThemePrefs>) => void;
  setApiKey: (key?: string) => void;
  setPrefs: (patch: Partial<Pick<UIState, "sounds" | "desktopNotifications">>) => void;
}

export type Store = { db: DB } & UIState & Actions;

const DEFAULT_THEME: ThemePrefs = {
  mode: "dark", accent: "#7c5cff", accent2: "#22d3ee", density: "cozy", glass: true, fontScale: 1, reducedMotion: false, wallpaper: "aurora",
};

// Debounced localStorage writer — keeps typing smooth even with large histories.
const debouncedStorage: StateStorage = (() => {
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  const pending: Record<string, string> = {};
  let warned = false;
  const write = (name: string) => {
    clearTimeout(timers[name]);
    if (pending[name] === undefined) return;
    try {
      localStorage.setItem(name, pending[name]);
    } catch (err) {
      if (!warned) console.warn("[pulse] storage quota reached — older attachments may not persist", err);
      warned = true;
    }
    delete pending[name];
  };
  // never lose the last write when the tab is closed or reloaded
  if (isBrowser) addEventListener("pagehide", () => Object.keys(pending).forEach(write));
  return {
    getItem: (name) => {
      if (!isBrowser) return null;
      write(name);
      return localStorage.getItem(name);
    },
    setItem: (name, value) => {
      if (!isBrowser) return;
      pending[name] = value;
      clearTimeout(timers[name]);
      timers[name] = setTimeout(() => write(name), 400);
    },
    removeItem: (name) => isBrowser && localStorage.removeItem(name),
  };
})();

const SESSION_KEY = "pulse-session";
const readSession = (): ID | undefined => {
  if (!isBrowser) return undefined;
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const writeSession = (id?: ID) => {
  if (!isBrowser) return;
  try {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
      localStorage.setItem(SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* private mode */
  }
};

type Listener = (ev: TransportEvent, local: boolean) => void;
const listeners = new Set<Listener>();
/** Subscribe to every applied event (local or remote). Used by the simulation engine and receipts. */
export const onEvent = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const me = () => {
        const id = get().sessionUserId;
        return id ? get().db.users[id] : undefined;
      };

      const statsOf = (userId: ID) => get().db.stats[userId] ?? { messages: 0, reactions: 0, achievements: [], streak: 0, daily: {} };
      const setStats = (userId: ID, patch: Partial<DB["stats"][string]>) =>
        set((s) => ({ db: { ...s.db, stats: { ...s.db.stats, [userId]: { ...statsOf(userId), ...patch } } } }));

      const checkAchievements = () => {
        const u = me();
        if (!u) return;
        const st = statsOf(u.id);
        const friends = Object.values(get().db.friends[u.id] ?? {}).filter((f) => f === "friends").length;
        const fresh = evaluateAchievements(
          { messages: st.messages, reactions: st.reactions, friends, streak: st.streak, level: levelFromXp(u.xp), hour: new Date().getHours() },
          st.achievements,
        );
        fresh.forEach((id) => get().unlock(id));
      };

      const afterLogin = (userId: ID) => {
        writeSession(userId);
        set({ sessionUserId: userId, activeServerId: "home", homeView: "friends", activeChannelId: undefined });
        const { dispatch } = get();
        const user = get().db.users[userId];
        dispatch("presence", { userId, status: user?.status === "offline" || !user?.status ? "online" : user.status, lastSeen: Date.now() });
        getTransport().connect({ userId });
        // daily streak + login reward
        const st = statsOf(userId);
        const today = dayKey();
        const { streak, isNewDay } = nextStreak(st.lastLoginDay, st.streak, today);
        if (isNewDay) {
          setStats(userId, { streak, lastLoginDay: today });
          setTimeout(() => {
            get().awardXp(XP_REWARDS.dailyLogin + XP_REWARDS.streakBonusPerDay * Math.min(streak, 10), "Daily login");
            get().toast({ title: streak > 1 ? `${streak}-day streak! 🔥` : "Daily login reward ☀️", body: `+${XP_REWARDS.dailyLogin + XP_REWARDS.streakBonusPerDay * Math.min(streak, 10)} XP daily reward`, tone: "level" });
            checkAchievements();
          }, 900);
        }
      };

      const novaReply = async (channelId: ID, userText: string) => {
        const { dispatch } = get();
        const u = me();
        if (!u) return;
        dispatch("typing", { channelId, userId: ASSISTANT_ID, active: true });
        let reply: string;
        const key = get().apiKey;
        try {
          if (key) {
            const history = (get().db.messages[channelId] ?? [])
              .filter((m) => !m.deletedAt && m.kind === "text" && (m.authorId === u.id || m.authorId === ASSISTANT_ID))
              .slice(-16)
              .map((m) => ({ role: m.authorId === ASSISTANT_ID ? ("assistant" as const) : ("user" as const), content: m.content || "…" }));
            // the API requires the first turn to be from the user
            while (history.length && history[0].role !== "user") history.shift();
            reply = await claudeAssistantReply(key, history.length ? history : [{ role: "user", content: userText }]);
          } else {
            await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
            reply = offlineAssistantReply(userText.replace(/@nova( ai)?/i, "").trim(), u.displayName);
          }
        } catch (err) {
          reply = `⚠️ I couldn't reach Claude (${err instanceof Error ? err.message.slice(0, 120) : "network error"}). Falling back to offline mode:\n\n${offlineAssistantReply(userText, u.displayName)}`;
        }
        dispatch("typing", { channelId, userId: ASSISTANT_ID, active: false });
        dispatch("message:new", {
          message: { id: uid("msg"), channelId, authorId: ASSISTANT_ID, kind: "text", content: reply, createdAt: Date.now(), status: "sent" },
        });
      };

      return {
        db: emptyDB(),
        hydrated: false,
        activeServerId: "home",
        homeView: "friends",
        rightPanel: "members",
        modal: null,
        typing: {},
        toasts: [],
        mobileNav: false,
        theme: DEFAULT_THEME,
        sounds: true,
        desktopNotifications: false,

        dispatch: (type, payload, opts) => {
          const ev: TransportEvent = { id: uid("ev"), type, payload, origin: getTransport().clientId, ts: Date.now() };
          if (type === "typing") {
            get().receive({ ...ev, origin: "self" });
          } else {
            set((s) => ({ db: applyEvent(s.db, ev) }));
          }
          if (!opts?.local) getTransport().publish(ev);
          listeners.forEach((l) => l(ev, true));
        },

        receive: (ev) => {
          if (ev.type === "typing") {
            const { channelId, userId, active } = ev.payload as EventPayloads["typing"];
            const key = `${channelId}|${userId}`;
            clearTimeout(typingTimers[key]);
            set((s) => {
              const ch = { ...(s.typing[channelId] ?? {}) };
              if (active) ch[userId] = Date.now();
              else delete ch[userId];
              return { typing: { ...s.typing, [channelId]: ch } };
            });
            if (active) typingTimers[key] = setTimeout(() => get().receive({ ...ev, payload: { channelId, userId, active: false } }), 6000);
            if (ev.origin !== "self") listeners.forEach((l) => l(ev, false));
            return;
          }
          set((s) => ({ db: applyEvent(s.db, ev) }));
          if (ev.type === "message:new") {
            // a message from someone clears their typing indicator
            const { message } = ev.payload as EventPayloads["message:new"];
            const ch = get().typing[message.channelId];
            if (ch?.[message.authorId]) get().receive({ ...ev, type: "typing", payload: { channelId: message.channelId, userId: message.authorId, active: false }, origin: "self" });
          }
          listeners.forEach((l) => l(ev, false));
        },

        ensureSeed: () => {
          const db = get().db;
          if (db.version === SEED_VERSION && Object.keys(db.servers).length) return;
          const seed = buildSeed();
          // existing human accounts stay members of the default communities after a re-seed
          const humans = Object.values(db.users).filter((u) => !u.isBot).map((u) => u.id);
          for (const sid of ["srv_hq", "srv_gaming", "srv_study", "srv_dev", "srv_art"]) {
            const s = seed.servers[sid];
            humans.forEach((h) => { s.memberIds.push(h); s.memberRoles[h] = [`${sid}:member`]; });
          }
          const userServers = Object.fromEntries(Object.entries(db.servers).filter(([id]) => !seed.servers[id]));
          set({ db: { ...emptyDB(), ...db, version: SEED_VERSION, users: { ...seed.users, ...db.users }, servers: { ...seed.servers, ...userServers }, channels: { ...seed.channels, ...pickDmChannels(db.channels) }, messages: { ...seed.messages, ...pickDmMessages(db.messages) } } });
        },

        resetDemo: () => {
          writeSession(undefined);
          set({ db: emptyDB(), sessionUserId: undefined, activeServerId: "home", activeChannelId: undefined, call: undefined });
          get().ensureSeed();
        },

        register: async ({ email, password, displayName, username, avatarColor }) => {
          const key = email.trim().toLowerCase();
          const db = get().db;
          if (!/^\S+@\S+\.\S+$/.test(key)) return { ok: false, error: "Enter a valid email address." };
          if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
          if (!/^[a-z0-9_.]{3,20}$/i.test(username)) return { ok: false, error: "Username: 3–20 letters, numbers, _ or ." };
          if (db.accounts[key]) return { ok: false, error: "An account with that email already exists." };
          if (Object.values(db.users).some((u) => u.username.toLowerCase() === username.toLowerCase())) return { ok: false, error: "That username is taken." };
          const salt = randomSalt();
          const passwordHash = await hashPassword(password, salt);
          const id = uid("usr");
          const now = Date.now();
          const isFirstHuman = !Object.values(db.accounts).length;
          const user: User = {
            id, username: username.toLowerCase(), displayName: displayName.trim() || username, avatarColor, bannerColor: "#22d3ee",
            bio: "", status: "online", lastSeen: now, isBot: false, badges: ["early", ...(isFirstHuman ? ["staff"] : [])],
            xp: 0, reputation: 0, joinedAt: now,
          };
          get().dispatch("user:upsert", { user, account: { userId: id, email: key, passwordHash, salt, createdAt: now, isAdmin: isFirstHuman } });
          joinDefaults(id);
          afterLogin(id);
          setTimeout(() => welcomeDm(id), 1200);
          return { ok: true };
        },

        login: async (email, password) => {
          await useStore.persist.rehydrate(); // pick up accounts created in other tabs
          get().ensureSeed();
          const acct = get().db.accounts[email.trim().toLowerCase()];
          if (!acct) return { ok: false, error: "No account found with that email." };
          const hash = await hashPassword(password, acct.salt);
          if (hash !== acct.passwordHash) return { ok: false, error: "Incorrect password." };
          if (get().db.bans[acct.userId]) return { ok: false, error: `This account is banned: ${get().db.bans[acct.userId]}` };
          afterLogin(acct.userId);
          return { ok: true };
        },

        loginDemo: async () => {
          const existing = get().db.accounts[DEMO_EMAIL];
          if (existing) {
            const r = await get().login(DEMO_EMAIL, DEMO_PASSWORD);
            if (r.ok) return;
          }
          const salt = randomSalt();
          const id = "usr_demo";
          const now = Date.now();
          const user: User = {
            id, username: "you", displayName: "Demo User", avatarColor: "#7c5cff", bannerColor: "#22d3ee",
            bio: "Exploring Pulse ✨", pronouns: "they/them", customStatus: "🚀 trying the demo", status: "online", lastSeen: now,
            isBot: false, badges: ["early", "staff", "supporter"], xp: 420, reputation: 120, joinedAt: now,
          };
          get().dispatch("user:upsert", { user, account: { userId: id, email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD, salt), salt, createdAt: now, isAdmin: true } });
          joinDefaults(id);
          // a few starting friends + an incoming request so the friends page isn't empty
          ["bot_0", "bot_3", "bot_7", "bot_12"].forEach((b) => get().dispatch("friend:update", { from: id, to: b, state: "friends" }));
          get().dispatch("friend:update", { from: "bot_5", to: id, state: "outgoing" });
          get().dispatch("friend:update", { from: "bot_9", to: id, state: "outgoing" });
          afterLogin(id);
          setTimeout(() => welcomeDm(id), 1200);
          seedDemoDms(id);
        },

        logout: () => {
          const u = me();
          if (u) get().dispatch("presence", { userId: u.id, status: "offline", lastSeen: Date.now() });
          writeSession(undefined);
          set({ sessionUserId: undefined, activeServerId: "home", activeChannelId: undefined, call: undefined, modal: null });
        },

        openServer: (serverId) => {
          if (serverId === "home") return set({ activeServerId: "home", activeChannelId: undefined, homeView: "friends", mobileNav: true });
          const server = get().db.servers[serverId];
          const first = server?.channelIds.find((c) => get().db.channels[c]?.kind !== "voice");
          const uid0 = get().sessionUserId;
          set({ openedReadAt: first && uid0 ? get().db.readState[uid0]?.[first] ?? 0 : 0, activeServerId: serverId, activeChannelId: first, rightPanel: get().rightPanel === "thread" ? "members" : get().rightPanel, threadParentId: undefined, mobileNav: true });
          if (first) get().markRead(first);
        },

        openChannel: (channelId) => {
          const ch = get().db.channels[channelId];
          if (!ch) return;
          if (ch.kind === "voice") return get().startCall(channelId, "voice");
          const meId = get().sessionUserId;
          set({ openedReadAt: meId ? get().db.readState[meId]?.[channelId] ?? 0 : 0, activeChannelId: channelId, activeServerId: ch.serverId ?? "home", homeView: ch.serverId ? get().homeView : "dm", threadParentId: undefined, replyToId: undefined, editingId: undefined, mobileNav: false, rightPanel: get().rightPanel === "thread" || (isBrowser && innerWidth < 640) ? null : get().rightPanel });
          get().markRead(channelId);
        },

        openDm: (userId) => {
          const u = me();
          if (!u || userId === u.id) return;
          const id = dmChannelId(u.id, userId);
          if (!get().db.channels[id]) {
            get().dispatch("channel:upsert", { channel: { id, kind: "dm", name: "", memberIds: [u.id, userId], createdAt: Date.now(), encrypted: true } });
          }
          set({ profileUserId: undefined, modal: null });
          get().openChannel(id);
        },

        setHomeView: (homeView) => set({ homeView, activeServerId: "home", activeChannelId: homeView === "dm" ? get().activeChannelId : undefined, mobileNav: false }),
        setRightPanel: (rightPanel) => set({ rightPanel: get().rightPanel === rightPanel ? null : rightPanel }),
        openThread: (threadParentId) => set({ threadParentId, rightPanel: "thread" }),
        setReplyTo: (replyToId) => set({ replyToId, editingId: undefined }),
        setEditing: (editingId) => set({ editingId, replyToId: undefined }),
        openModal: (kind, props) => set({ modal: { kind, props } }),
        closeModal: () => set({ modal: null }),
        showProfile: (profileUserId) => set({ profileUserId }),
        setMobileNav: (mobileNav) => set({ mobileNav }),
        jumpTo: (channelId, messageId) => {
          get().openChannel(channelId);
          set({ jumpToId: messageId });
          setTimeout(() => set({ jumpToId: undefined }), 2500);
        },

        sendMessage: async (channelId, draft) => {
          const u = me();
          const ch = get().db.channels[channelId];
          if (!u || !ch) return;
          if (isMuted(get().db, u.id)) {
            get().toast({ title: "You are muted", body: "A moderator has temporarily muted you.", tone: "danger" });
            return;
          }
          const mentions = [...draft.content.matchAll(/@([\w.]+)/g)]
            .map((m) => Object.values(get().db.users).find((x) => x.username === m[1].toLowerCase() || x.displayName.split(" ")[0].toLowerCase() === m[1].toLowerCase())?.id)
            .filter(Boolean) as ID[];
          const message: Message = {
            kind: "text", ...draft, id: uid("msg"), channelId, authorId: u.id, createdAt: Date.now(), status: "sent", mentions,
            replyToId: draft.replyToId ?? get().replyToId, threadParentId: draft.threadParentId,
          };
          if (ch.encrypted && ch.memberIds && message.content) {
            try {
              message.ciphertext = await encryptForChannel(message.content, ch.id, ch.memberIds);
            } catch { /* WebCrypto unavailable */ }
          }
          get().dispatch("message:new", { message });
          get().dispatch("typing", { channelId, userId: u.id, active: false });
          set({ replyToId: undefined });
          get().markRead(channelId);

          // gamification
          const st = statsOf(u.id);
          const today = dayKey();
          setStats(u.id, { messages: st.messages + 1, daily: { ...st.daily, [today]: (st.daily[today] ?? 0) + 1 } });
          const xp = message.kind === "voice" ? XP_REWARDS.voiceNote : message.attachments?.some((a) => a.kind === "image") ? XP_REWARDS.image : XP_REWARDS.message;
          get().awardXp(xp);
          if ([10, 50, 100, 250, 500, 1000].includes(st.messages + 1)) {
            get().toast({ title: `Milestone: ${st.messages + 1} messages! 🎉`, body: "Keep the conversation going.", tone: "level" });
          }
          if (message.kind === "voice") get().unlock("voice");
          if (message.attachments?.some((a) => a.kind === "image")) get().unlock(draft.content.startsWith("[meme]") ? "meme-lord" : "photographer");
          if (message.kind === "poll") { get().unlock("pollster"); get().awardXp(XP_REWARDS.pollCreated); }
          checkAchievements();

          // the assistant answers in the sender's tab (it may use their API key)
          const isNovaDm = ch.kind === "dm" && ch.memberIds?.includes(ASSISTANT_ID);
          if (isNovaDm || /@nova\b/i.test(message.content)) void novaReply(channelId, message.content);
          return message;
        },

        editMessage: (channelId, id, content) => {
          get().dispatch("message:update", { channelId, id, patch: { content, editedAt: Date.now() } });
          set({ editingId: undefined });
        },

        deleteMessage: (channelId, id) => get().dispatch("message:delete", { channelId, id }),

        toggleReaction: (channelId, id, emoji) => {
          const u = me();
          if (!u) return;
          const msg = get().db.messages[channelId]?.find((m) => m.id === id);
          const adding = !msg?.reactions?.[emoji]?.includes(u.id);
          get().dispatch("reaction:toggle", { channelId, id, emoji, userId: u.id });
          if (adding) {
            const st = statsOf(u.id);
            setStats(u.id, { reactions: st.reactions + 1 });
            get().awardXp(XP_REWARDS.reaction);
            checkAchievements();
          }
        },

        votePoll: (channelId, id, optionId) => {
          const u = me();
          if (u) get().dispatch("poll:vote", { channelId, id, optionId, userId: u.id });
        },

        answerTrivia: (channelId, id, choice) => {
          const u = me();
          const msg = get().db.messages[channelId]?.find((m) => m.id === id);
          if (!u || !msg?.trivia || msg.trivia.answeredBy[u.id] !== undefined) return;
          const trivia: Trivia = { ...msg.trivia, answeredBy: { ...msg.trivia.answeredBy, [u.id]: choice } };
          const correct = choice === msg.trivia.answer;
          if (correct && !trivia.winnerId) trivia.winnerId = u.id;
          get().dispatch("message:update", { channelId, id, patch: { trivia } });
          if (correct && trivia.winnerId === u.id) {
            get().awardXp(XP_REWARDS.triviaWin, "Trivia win");
            get().unlock("trivia-win");
            get().toast({ title: "Correct! 🧠", body: `+${XP_REWARDS.triviaWin} XP — you won this round`, tone: "success" });
          } else if (correct) {
            get().toast({ title: "Correct!", body: "…but someone was faster this time 😅" });
          } else {
            get().toast({ title: "Not quite 😬", body: `The answer was "${msg.trivia.choices[msg.trivia.answer]}"`, tone: "warn" });
          }
        },

        togglePin: (channelId, id) => {
          const msg = get().db.messages[channelId]?.find((m) => m.id === id);
          if (!msg) return;
          get().dispatch("message:update", { channelId, id, patch: { pinned: !msg.pinned } });
          get().toast({ title: msg.pinned ? "Message unpinned" : "Message pinned 📌" });
        },

        toggleSave: (channelId, id) => {
          const u = me();
          if (!u) return;
          const key = `${channelId}::${id}`;
          const cur = get().db.saved[u.id] ?? [];
          const next = cur.includes(key) ? cur.filter((k) => k !== key) : [key, ...cur];
          set((s) => ({ db: { ...s.db, saved: { ...s.db.saved, [u.id]: next } } }));
          get().toast({ title: cur.includes(key) ? "Removed from saved" : "Saved for later 🔖" });
        },

        reportMessage: (channelId, id, reason) => {
          const u = me();
          if (!u) return;
          set((s) => ({ db: { ...s.db, reports: [{ id: uid("rep"), messageId: `${channelId}::${id}`, reporterId: u.id, reason, createdAt: Date.now(), resolved: false }, ...s.db.reports] } }));
          get().toast({ title: "Report sent", body: "Moderators will review it shortly.", tone: "success" });
        },

        setTyping: (channelId, active) => {
          const u = me();
          if (u) get().dispatch("typing", { channelId, userId: u.id, active });
        },

        markRead: (channelId) => {
          const u = me();
          if (!u) return;
          const now = Date.now();
          set((s) => ({ db: { ...s.db, readState: { ...s.db.readState, [u.id]: { ...(s.db.readState[u.id] ?? {}), [channelId]: now } } } }));
          // send read receipts for other humans' messages in DMs
          const ch = get().db.channels[channelId];
          if (ch && (ch.kind === "dm" || ch.kind === "group-dm")) {
            for (const m of (get().db.messages[channelId] ?? []).slice(-30)) {
              if (m.authorId !== u.id && !m.readBy?.includes(u.id)) {
                get().dispatch("message:update", { channelId, id: m.id, patch: { status: "read", readBy: [u.id] } });
              }
            }
          }
        },

        scheduleMessage: (channelId, content, sendAt) => {
          const u = me();
          if (!u) return;
          set((s) => ({ db: { ...s.db, scheduled: [...s.db.scheduled, { id: uid("sch"), channelId, content, sendAt, authorId: u.id }] } }));
          get().toast({ title: "Message scheduled ⏰", body: `Sends at ${new Date(sendAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` });
        },
        cancelScheduled: (id) => set((s) => ({ db: { ...s.db, scheduled: s.db.scheduled.filter((x) => x.id !== id) } })),

        sendFriendRequest: (userId) => {
          const u = me();
          if (!u) return;
          const cur = get().db.friends[u.id]?.[userId];
          if (cur === "incoming") return get().respondFriend(userId, true);
          if (cur) return;
          get().dispatch("friend:update", { from: u.id, to: userId, state: "outgoing" });
          get().toast({ title: "Friend request sent", body: `to ${get().db.users[userId]?.displayName}` });
        },
        respondFriend: (userId, accept) => {
          const u = me();
          if (!u) return;
          get().dispatch("friend:update", { from: u.id, to: userId, state: accept ? "friends" : "none" });
          if (accept) {
            get().awardXp(XP_REWARDS.friendAdded, "New friend");
            get().toast({ title: "You're now friends! 🤝", body: get().db.users[userId]?.displayName, tone: "success" });
            checkAchievements();
          }
        },
        removeFriend: (userId) => {
          const u = me();
          if (u) get().dispatch("friend:update", { from: u.id, to: userId, state: "none" });
        },
        blockUser: (userId) => {
          const u = me();
          if (u) get().dispatch("friend:update", { from: u.id, to: userId, state: "blocked" });
          get().toast({ title: "User blocked", tone: "warn" });
        },

        updateProfile: (patch) => {
          const u = me();
          if (u) get().dispatch("user:upsert", { user: { ...u, ...patch } });
        },
        setPresence: (status) => {
          const u = me();
          if (u) get().dispatch("presence", { userId: u.id, status, lastSeen: Date.now() });
        },

        createServer: ({ name, icon, color, description, template, isPublic }) => {
          const u = me()!;
          const id = uid("srv");
          const now = Date.now();
          const templates: Record<string, { cat: string; chans: [string, Channel["kind"]][] }[]> = {
            community: [{ cat: "Text Channels", chans: [["general", "text"], ["introductions", "text"], ["memes", "text"]] }, { cat: "Voice", chans: [["Lounge", "voice"]] }],
            gaming: [{ cat: "Text", chans: [["general", "text"], ["lfg", "text"], ["clips", "text"]] }, { cat: "Voice", chans: [["Squad", "voice"], ["AFK", "voice"]] }],
            study: [{ cat: "Study", chans: [["general", "text"], ["homework-help", "text"], ["resources", "text"]] }, { cat: "Voice", chans: [["Focus Room", "voice"]] }],
            club: [{ cat: "Info", chans: [["announcements", "announcement"], ["events", "text"]] }, { cat: "Chat", chans: [["general", "text"]] }, { cat: "Voice", chans: [["Meeting Room", "voice"]] }],
          };
          const cats = templates[template] ?? templates.community;
          const categories = cats.map((c, i) => ({ id: `${id}:cat:${i}`, name: c.cat }));
          const channelIds: ID[] = [];
          cats.forEach((c, i) => c.chans.forEach(([n, kind]) => {
            const cid = `${id}:${n.toLowerCase().replace(/\s+/g, "-")}`;
            channelIds.push(cid);
            get().dispatch("channel:upsert", { channel: { id: cid, name: kind === "voice" ? n : n.toLowerCase(), kind, serverId: id, categoryId: `${id}:cat:${i}`, createdAt: now, topic: "" } });
          }));
          const server: Server = {
            id, name, icon, color, description, ownerId: u.id, memberIds: [u.id], categories, channelIds, isPublic, tags: [template], createdAt: now,
            roles: [
              { id: `${id}:everyone`, name: "@everyone", color: "#94a3b8", permissions: DEFAULT_MEMBER, position: 0 },
              { id: `${id}:mod`, name: "Moderator", color: "#34d399", permissions: MODERATOR, position: 1, hoist: true },
              { id: `${id}:admin`, name: "Admin", color: "#f472b6", permissions: ALL_PERMS, position: 2, hoist: true },
            ],
            memberRoles: { [u.id]: [`${id}:admin`] },
            customEmojis: [],
          };
          get().dispatch("server:upsert", { server });
          get().dispatch("message:new", { message: { id: uid("msg"), channelId: channelIds[0], authorId: ASSISTANT_ID, kind: "system", content: `✨ **${name}** was created by ${u.displayName}. Invite friends to get it going!`, createdAt: now, status: "sent" } });
          get().awardXp(XP_REWARDS.serverCreated, "Server created");
          get().unlock("server-owner");
          if (!u.badges.includes("founder")) get().updateProfile({ badges: [...u.badges, "founder"] });
          get().openServer(id);
          return id;
        },

        joinServer: (serverId) => {
          const u = me();
          const s = get().db.servers[serverId];
          if (!u || !s || s.memberIds.includes(u.id)) return;
          get().dispatch("server:upsert", { server: { ...s, memberIds: [...s.memberIds, u.id], memberRoles: { ...s.memberRoles, [u.id]: [] } } });
          const first = s.channelIds.find((c) => get().db.channels[c]?.kind === "text");
          if (first) get().dispatch("message:new", { message: { id: uid("msg"), channelId: first, authorId: u.id, kind: "system", content: `👋 **${u.displayName}** joined the server.`, createdAt: Date.now(), status: "sent" } });
          get().toast({ title: `Joined ${s.name}`, icon: s.icon, tone: "success" });
          get().openServer(serverId);
        },

        leaveServer: (serverId) => {
          const u = me();
          const s = get().db.servers[serverId];
          if (!u || !s) return;
          get().dispatch("server:upsert", { server: { ...s, memberIds: s.memberIds.filter((m) => m !== u.id) } });
          get().openServer("home");
        },

        updateServer: (server) => get().dispatch("server:upsert", { server }),

        createChannel: (serverId, { name, kind, categoryId, topic }) => {
          const s = get().db.servers[serverId];
          if (!s) return;
          const id = `${serverId}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 5)}`;
          get().dispatch("channel:upsert", { channel: { id, kind, name: kind === "voice" ? name : name.toLowerCase().replace(/\s+/g, "-"), serverId, categoryId: categoryId ?? s.categories[0]?.id, topic, createdAt: Date.now() } });
          get().dispatch("server:upsert", { server: { ...s, channelIds: [...s.channelIds, id] } });
          if (kind !== "voice") get().openChannel(id);
        },

        deleteChannel: (channelId) => {
          const ch = get().db.channels[channelId];
          if (!ch?.serverId) return;
          const s = get().db.servers[ch.serverId];
          get().dispatch("server:upsert", { server: { ...s, channelIds: s.channelIds.filter((c) => c !== channelId) } });
          get().dispatch("channel:upsert", { channel: ch, remove: true });
          if (get().activeChannelId === channelId) get().openServer(ch.serverId);
        },

        createGroupDm: (userIds, name) => {
          const u = me()!;
          const id = uid("gdm");
          get().dispatch("channel:upsert", { channel: { id, kind: "group-dm", name: name || userIds.map((x) => get().db.users[x]?.displayName.split(" ")[0]).join(", "), memberIds: [u.id, ...userIds], createdAt: Date.now(), encrypted: true } });
          get().dispatch("message:new", { message: { id: uid("msg"), channelId: id, authorId: u.id, kind: "system", content: `**${u.displayName}** created the group.`, createdAt: Date.now(), status: "sent" } });
          get().openChannel(id);
          return id;
        },

        moderate: (userId, kind, reason, durationMs, serverId) => {
          const u = me();
          if (!u) return;
          const action: ModerationAction = { id: uid("mod"), userId, moderatorId: u.id, kind, reason, createdAt: Date.now(), expiresAt: durationMs ? Date.now() + durationMs : undefined, serverId };
          get().dispatch("moderation", { action });
          const target = get().db.users[userId];
          if (kind === "ban" && serverId) {
            const s = get().db.servers[serverId];
            if (s) get().dispatch("server:upsert", { server: { ...s, memberIds: s.memberIds.filter((m) => m !== userId) } });
          }
          if (kind === "ban" && target) get().dispatch("presence", { userId, status: "offline", lastSeen: Date.now() });
          get().toast({ title: `${kind[0].toUpperCase()}${kind.slice(1)}: ${target?.displayName ?? userId}`, body: reason, tone: kind === "ban" || kind === "mute" ? "danger" : "default" });
        },

        resolveReport: (id) => set((s) => ({ db: { ...s.db, reports: s.db.reports.map((r) => (r.id === id ? { ...r, resolved: true } : r)) } })),

        awardXp: (amount, reason) => {
          const u = me();
          if (!u || amount <= 0) return;
          const before = levelFromXp(u.xp);
          const xp = u.xp + amount;
          const after = levelFromXp(xp);
          get().dispatch("user:upsert", { user: { ...u, xp, reputation: u.reputation + (reason ? 2 : 0) } });
          if (after > before) {
            get().toast({ title: `Level up! You're now level ${after} ⭐`, body: reason ?? "Keep it up!", tone: "level" });
            get().notify({ title: `Reached level ${after}`, body: "New flair unlocked on your profile.", kind: "level", icon: "⭐" });
            checkAchievements();
          }
        },

        unlock: (achievementId) => {
          const u = me();
          if (!u) return;
          const st = statsOf(u.id);
          if (st.achievements.includes(achievementId)) return;
          const a = ACHIEVEMENTS.find((x) => x.id === achievementId);
          if (!a) return;
          setStats(u.id, { achievements: [...st.achievements, achievementId] });
          get().toast({ title: `Achievement unlocked: ${a.name}`, body: `${a.description}${a.xp ? ` · +${a.xp} XP` : ""}`, icon: a.emoji, tone: "level" });
          get().notify({ title: `Achievement: ${a.name}`, body: a.description, kind: "achievement", icon: a.emoji });
          if (achievementId === "streak-7" && !u.badges.includes("streak")) get().updateProfile({ badges: [...u.badges, "streak"] });
          if (achievementId === "trivia-win" && !u.badges.includes("bigbrain")) get().updateProfile({ badges: [...(me()?.badges ?? []), "bigbrain"] });
          if (a.xp) setTimeout(() => get().awardXp(a.xp), 50);
        },

        notify: (n) => {
          const u = me();
          if (!u) return;
          const item: Notification = { ...n, id: uid("ntf"), createdAt: Date.now(), read: false };
          set((s) => ({ db: { ...s.db, notifications: { ...s.db.notifications, [u.id]: [item, ...(s.db.notifications[u.id] ?? [])].slice(0, 100) } } }));
        },
        markNotificationsRead: () => {
          const u = me();
          if (!u) return;
          set((s) => ({ db: { ...s.db, notifications: { ...s.db.notifications, [u.id]: (s.db.notifications[u.id] ?? []).map((n) => ({ ...n, read: true })) } } }));
        },

        toast: (t) => {
          const id = uid("toast");
          set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
          setTimeout(() => get().dismissToast(id), t.tone === "level" ? 5200 : 4200);
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        addStroke: (channelId, stroke) => {
          get().dispatch("whiteboard:stroke", { channelId, stroke });
          get().unlock("artist");
        },
        clearWhiteboard: (channelId) => get().dispatch("whiteboard:clear", { channelId }),

        startCall: (channelId, kind) => {
          const u = me();
          const ch = get().db.channels[channelId];
          if (!u || !ch) return;
          let participants: ID[];
          if (ch.memberIds) participants = ch.memberIds;
          else {
            const s = ch.serverId ? get().db.servers[ch.serverId] : undefined;
            const online = (s?.memberIds ?? []).filter((m) => get().db.users[m]?.isBot && get().db.users[m]?.status === "online");
            participants = [u.id, ...online.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 4))];
          }
          set({ call: { channelId, kind, startedAt: Date.now(), participants: [...new Set([u.id, ...participants])], muted: false, deafened: false, camera: kind === "video", screen: false } });
          get().unlock("caller");
          if (ch.kind === "dm" || ch.kind === "group-dm") {
            get().dispatch("message:new", { message: { id: uid("msg"), channelId, authorId: u.id, kind: "call", content: `${kind === "video" ? "📹 Video" : "📞 Voice"} call started`, createdAt: Date.now(), status: "sent" } });
          }
        },
        updateCall: (patch) => set((s) => (s.call ? { call: { ...s.call, ...patch } } : {})),
        endCall: () => {
          const c = get().call;
          const ch = c ? get().db.channels[c.channelId] : undefined;
          if (c && ch && (ch.kind === "dm" || ch.kind === "group-dm")) {
            const mins = Math.max(1, Math.round((Date.now() - c.startedAt) / 60000));
            get().dispatch("message:new", { message: { id: uid("msg"), channelId: c.channelId, authorId: get().sessionUserId!, kind: "call", content: `Call ended · ${mins} min`, createdAt: Date.now(), status: "sent" } });
          }
          set({ call: undefined });
        },

        setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch } })),
        setApiKey: (apiKey) => set({ apiKey: apiKey?.trim() || undefined }),
        setPrefs: (patch) => set(patch),
      };

      // ——— helpers that need get/set ———
      function joinDefaults(userId: ID) {
        const db = get().db;
        for (const s of Object.values(db.servers)) {
          if (["srv_hq", "srv_gaming", "srv_study", "srv_dev", "srv_art"].includes(s.id) && !s.memberIds.includes(userId)) {
            get().dispatch("server:upsert", { server: { ...s, memberIds: [...s.memberIds, userId], memberRoles: { ...s.memberRoles, [userId]: [`${s.id}:member`] } } });
          }
        }
      }

      function welcomeDm(userId: ID) {
        const id = dmChannelId(userId, ASSISTANT_ID);
        if (!get().db.channels[id]) get().dispatch("channel:upsert", { channel: { id, kind: "dm", name: "", memberIds: [userId, ASSISTANT_ID], createdAt: Date.now(), encrypted: true } });
        const name = get().db.users[userId]?.displayName.split(" ")[0] ?? "there";
        get().dispatch("message:new", { message: { id: uid("msg"), channelId: id, authorId: ASSISTANT_ID, kind: "text", createdAt: Date.now(), status: "sent", content: `Hey ${name}! 👋 I'm **Nova**, your Pulse assistant.\n\nEverything here is a live simulation: 50+ AI users chatting, reacting, and going online/offline in real time. Try saying hi in **#general**, DM someone from the member list, or type **help** here to see what I can do. ✨` } });
        get().notify({ title: "Nova AI", body: "Welcome to Pulse! Say hi 👋", kind: "message", channelId: id, icon: "✨" });
      }

      function seedDemoDms(userId: ID) {
        const convos: [ID, string[]][] = [
          ["bot_0", ["yo! you hopping on later? 🎮", "we need a 4th for ranked"]],
          ["bot_3", ["omg did you see the new art challenge in #showcase?", "you should totally enter ✨"]],
          ["bot_12", ["hey! thanks for the help with the project yesterday", "seriously saved me 🙏"]],
        ];
        convos.forEach(([botId, lines], ci) => {
          const id = dmChannelId(userId, botId);
          get().dispatch("channel:upsert", { channel: { id, kind: "dm", name: "", memberIds: [userId, botId], createdAt: Date.now(), encrypted: true } });
          lines.forEach((content, i) => get().dispatch("message:new", { message: { id: uid("msg"), channelId: id, authorId: botId, kind: "text", content, createdAt: Date.now() - (3 - ci) * 3_600_000 + i * 40_000, status: "delivered" } }));
        });
      }
    },
    {
      name: "pulse-db-v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (s) => ({ db: s.db, theme: s.theme, apiKey: s.apiKey, sounds: s.sounds, desktopNotifications: s.desktopNotifications }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...current, ...p, db: { ...emptyDB(), ...(p.db ?? current.db) }, theme: { ...current.theme, ...(p.theme ?? {}) } };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.ensureSeed();
        const sid = readSession();
        if (sid && state.db.users[sid] && !state.db.bans[sid]) {
          useStore.setState({ sessionUserId: sid });
          getTransport().connect({ userId: sid });
          state.dispatch("presence", { userId: sid, status: state.db.users[sid].status === "offline" ? "online" : state.db.users[sid].status, lastSeen: Date.now() });
        }
        useStore.setState({ hydrated: true });
      },
      skipHydration: true,
    },
  ),
);

function pickDmChannels(channels: Record<ID, Channel>) {
  return Object.fromEntries(Object.entries(channels).filter(([, c]) => !c.serverId || !c.serverId.startsWith("srv_") || c.serverId.length > 12));
}
function pickDmMessages(messages: Record<ID, Message[]>) {
  return Object.fromEntries(Object.entries(messages).filter(([k]) => !k.startsWith("srv_") || /^srv_[a-z0-9]{12,}/.test(k)));
}

// ——— selectors ———
export const useMe = () => useStore((s) => (s.sessionUserId ? s.db.users[s.sessionUserId] : undefined));
export const useIsAdmin = () =>
  useStore((s) => !!s.sessionUserId && Object.values(s.db.accounts).some((a) => a.userId === s.sessionUserId && a.isAdmin));

export function channelTitle(db: DB, ch: Channel | undefined, meId?: ID): string {
  if (!ch) return "";
  if (ch.kind === "dm") {
    const other = ch.memberIds?.find((m) => m !== meId);
    return db.users[other ?? ""]?.displayName ?? "Direct Message";
  }
  return ch.name;
}

export function dmPartner(db: DB, ch: Channel | undefined, meId?: ID): User | undefined {
  if (!ch || ch.kind !== "dm") return undefined;
  return db.users[ch.memberIds?.find((m) => m !== meId) ?? ""];
}

export function channelMembers(db: DB, ch: Channel | undefined): ID[] {
  if (!ch) return [];
  if (ch.memberIds) return ch.memberIds;
  return ch.serverId ? db.servers[ch.serverId]?.memberIds ?? [] : [];
}

export type { Attachment, Poll };
export { BADGES };
