import { useStore, onEvent } from "../store";
import type { EventPayloads } from "../store/reducer";
import { dmChannelId } from "../store/reducer";
import type { ID, Message, Presence, User } from "../types";
import { ambientLine, generateReply, reactionFor } from "./replies";
import { ASSISTANT_ID } from "./personas";
import { BUILTIN_GIFS } from "../content";
import { chance, pick, rand, uid } from "../utils";

// The simulation engine makes the world feel alive: bots type, reply, react,
// vote, answer trivia, accept friend requests and drift on/offline. It runs in
// exactly one tab (see electLeader) and speaks only through store.dispatch, so
// everything it does flows over the same transport as real users.

const timers = new Set<ReturnType<typeof setTimeout>>();
function later(ms: number, fn: () => void) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
}

const S = () => useStore.getState();
const db = () => S().db;
const isBot = (id: ID) => !!db().users[id]?.isBot;
const isHumanId = (id: ID) => !!db().users[id] && !db().users[id].isBot;

function membersOf(channelId: ID): ID[] {
  const ch = db().channels[channelId];
  if (!ch) return [];
  if (ch.memberIds) return ch.memberIds;
  return ch.serverId ? db().servers[ch.serverId]?.memberIds ?? [] : [];
}

const onlineBots = (ids: ID[]) => ids.filter((id) => id !== ASSISTANT_ID && isBot(id) && ["online", "idle"].includes(db().users[id].status));

function botSay(botId: ID, channelId: ID, content: string, extra: Partial<Message> = {}, delay = rand(600, 1800)) {
  const typingFor = Math.min(6500, 900 + content.length * rand(35, 70));
  later(delay, () => {
    S().dispatch("typing", { channelId, userId: botId, active: true });
    later(typingFor, () => {
      if (!db().channels[channelId]) return;
      S().dispatch("typing", { channelId, userId: botId, active: false });
      S().dispatch("message:new", {
        message: { id: uid("msg"), channelId, authorId: botId, kind: "text", content, createdAt: Date.now(), status: "sent", ...extra },
      });
    });
  });
}

function setStatus(userId: ID, status: Presence) {
  S().dispatch("presence", { userId, status, lastSeen: Date.now() });
}

/** React to a human's message: receipts, replies, reactions. */
function handleHumanMessage(m: Message) {
  const ch = db().channels[m.channelId];
  if (!ch || m.kind === "system" || m.kind === "call") return;
  const members = membersOf(m.channelId);
  const bots = members.filter((id) => isBot(id) && id !== ASSISTANT_ID);
  if (!bots.length) return;
  const author = db().users[m.authorId];
  const isDm = ch.kind === "dm" || ch.kind === "group-dm";

  // delivery receipt once any recipient is reachable
  later(rand(350, 1100), () => S().dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { status: "delivered" } }));

  if (m.kind === "poll" && m.poll) {
    const voters = onlineBots(members).sort(() => Math.random() - 0.5).slice(0, rand(3, 11));
    voters.forEach((v, i) => later(rand(2000, 6000) + i * rand(800, 2600), () => {
      const opts = m.poll!.options;
      // bots have mild preferences so results look natural, not uniform
      const o = Math.random() < 0.45 ? opts[0] : pick(opts);
      S().dispatch("poll:vote", { channelId: m.channelId, id: m.id, optionId: o.id, userId: v });
    }));
    return;
  }

  if (isDm) {
    const bot = bots[0];
    const u = db().users[bot];
    const reply = () => {
      S().dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { status: "read", readBy: [bot] } });
      if (chance(0.25)) later(rand(300, 900), () => S().dispatch("reaction:toggle", { channelId: m.channelId, id: m.id, emoji: reactionFor(m.content), userId: bot, on: true }));
      const text = m.kind === "gif" ? pick(["LMAO", "😂😂", "that gif 💀", "accurate"]) : m.kind === "voice" ? pick(["just listened, haha yes", "love the voice note 😂", "omg your voice lol, agreed"]) : m.attachments?.length ? pick(["ooh nice!", "wait that's so cool", "😍", "send more!!"]) : generateReply({ text: m.content, authorName: author?.displayName ?? "friend", botName: u.displayName, personaKey: u.persona });
      botSay(bot, m.channelId, text, {}, rand(500, 1500));
      if (chance(0.3)) later(rand(9000, 16000), () => botSay(bot, m.channelId, ambientLine(u.persona), {}, 0));
    };
    if (u.status === "offline" || u.status === "dnd") {
      // offline/dnd people get back to you eventually
      if (chance(0.7)) later(rand(8000, 20000), () => { setStatus(bot, "online"); reply(); });
    } else {
      later(u.status === "idle" ? rand(2500, 6000) : rand(400, 1600), reply);
    }
    return;
  }

  // server channel: mentions get answered, otherwise 1–2 people chime in
  const mentioned = (m.mentions ?? []).filter((id) => bots.includes(id));
  const pool = onlineBots(members);
  const responders = mentioned.length ? mentioned : chance(0.75) ? pool.sort(() => Math.random() - 0.5).slice(0, chance(0.35) ? 2 : 1) : [];
  responders.forEach((bot, i) => {
    const u = db().users[bot];
    if (mentioned.includes(bot) && u.status === "offline") setStatus(bot, "online");
    const text = generateReply({ text: m.content, authorName: author?.displayName ?? "friend", botName: u.displayName, personaKey: u.persona });
    botSay(bot, m.channelId, text, { replyToId: chance(0.35) || mentioned.length ? m.id : undefined, threadParentId: m.threadParentId }, rand(900, 2500) + i * rand(2500, 5000));
  });
  later(rand(1500, 4000), () => S().dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { status: "read", readBy: pool.slice(0, 5) } }));
  // drive-by reactions
  pool.filter(() => chance(0.12)).slice(0, 4).forEach((bot, i) =>
    later(rand(1200, 5000) + i * 700, () => S().dispatch("reaction:toggle", { channelId: m.channelId, id: m.id, emoji: reactionFor(m.content), userId: bot, on: true })),
  );
}

function handleTrivia(m: Message) {
  if (!m.trivia) return;
  const answerers = onlineBots(membersOf(m.channelId)).sort(() => Math.random() - 0.5).slice(0, rand(2, 6));
  answerers.forEach((bot, i) => later(rand(5000, 9000) + i * rand(2000, 5000), () => {
    const cur = db().messages[m.channelId]?.find((x) => x.id === m.id);
    if (!cur?.trivia || cur.trivia.winnerId) return;
    const correct = Math.random() < 0.5;
    const choice = correct ? cur.trivia.answer : (cur.trivia.answer + rand(1, 3)) % cur.trivia.choices.length;
    const trivia = { ...cur.trivia, answeredBy: { ...cur.trivia.answeredBy, [bot]: choice }, winnerId: correct ? bot : undefined };
    S().dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { trivia } });
    if (correct) botSay(bot, m.channelId, pick(["EZ 😎", "called it", "yesss first try", "big brain moment 🧠", "gg"]), {}, 400);
  }));
}

function ambientTick() {
  const s = S();
  const humans = Object.values(db().users).filter((u) => !u.isBot && u.status !== "offline");
  const activeCh = s.activeChannelId ? db().channels[s.activeChannelId] : undefined;
  const textChannels = Object.values(db().channels).filter((c) => c.serverId && c.kind === "text" && db().servers[c.serverId]?.memberIds.some((m) => isHumanId(m)));
  const channel = activeCh?.serverId && activeCh.kind !== "voice" && chance(0.55) ? activeCh : pick(textChannels);
  if (!channel) return;
  const bots = onlineBots(membersOf(channel.id));
  if (!bots.length) return;
  const bot = pick(bots);
  const u = db().users[bot];
  const history = db().messages[channel.id] ?? [];
  const last = history[history.length - 1];

  if (chance(0.06)) {
    const g = pick(BUILTIN_GIFS);
    botSay(bot, channel.id, g.title, { kind: "gif", gif: { id: g.id, title: g.title, emoji: g.emoji, gradient: g.gradient } });
  } else if (last && last.authorId !== bot && !last.deletedAt && last.kind === "text" && chance(0.55) && Date.now() - last.createdAt < 120_000) {
    botSay(bot, channel.id, generateReply({ text: last.content, authorName: db().users[last.authorId]?.displayName ?? "", botName: u.displayName, personaKey: u.persona }), { replyToId: chance(0.25) ? last.id : undefined });
  } else {
    botSay(bot, channel.id, ambientLine(u.persona));
  }

  // occasionally react to something recent
  const recent = history.slice(-6).filter((m) => !m.deletedAt && m.authorId !== bot);
  if (recent.length && chance(0.35)) {
    const target = pick(recent);
    later(rand(800, 3000), () => S().dispatch("reaction:toggle", { channelId: channel.id, id: target.id, emoji: reactionFor(target.content), userId: pick(bots), on: true }));
  }

  // now and then, someone slides into a human's DMs
  if (humans.length && chance(0.07)) {
    const h = pick(humans);
    const friendIds = Object.entries(db().friends[h.id] ?? {}).filter(([, st]) => st === "friends").map(([id]) => id).filter(isBot);
    const dmBot = friendIds.length && chance(0.7) ? pick(friendIds) : pick(onlineBots(Object.keys(db().users)));
    if (dmBot && db().friends[h.id]?.[dmBot] !== "blocked") {
      const id = dmChannelId(h.id, dmBot);
      if (!db().channels[id]) S().dispatch("channel:upsert", { channel: { id, kind: "dm", name: "", memberIds: [h.id, dmBot], createdAt: Date.now(), encrypted: true } });
      botSay(dmBot, id, ambientLine(db().users[dmBot].persona));
    }
  }
  // rare inbound friend requests
  if (humans.length && chance(0.03)) {
    const h = pick(humans);
    const candidate = pick(onlineBots(Object.keys(db().users)));
    if (candidate && !db().friends[h.id]?.[candidate]) S().dispatch("friend:update", { from: candidate, to: h.id, state: "outgoing" });
  }
}

function presenceTick() {
  const bots = Object.values(db().users).filter((u) => u.isBot && u.id !== ASSISTANT_ID);
  for (let i = 0; i < rand(1, 3); i++) {
    const b = pick(bots);
    const next: Presence = b.status === "offline" ? pick(["online", "online", "idle"] as Presence[]) : chance(0.3) ? "offline" : pick(["online", "idle", "dnd", "online"] as Presence[]);
    setStatus(b.id, next);
  }
}

function onFriendUpdate(p: EventPayloads["friend:update"]) {
  // humans asking bots → bots usually accept after a moment
  if (isHumanId(p.from) && isBot(p.to) && p.state === "outgoing") {
    later(rand(3000, 12000), () => {
      if (db().friends[p.to]?.[p.from] !== "incoming") return;
      if (chance(0.9)) {
        S().dispatch("friend:update", { from: p.to, to: p.from, state: "friends" });
        botSay(p.to, dmChannelId(p.from, p.to), pick(["hey! thanks for the add 😊", "yooo thanks for the request!", "hiii new friend ✨", "ayy what's up!"]), {}, rand(1500, 4000));
        const id = dmChannelId(p.from, p.to);
        if (!db().channels[id]) S().dispatch("channel:upsert", { channel: { id, kind: "dm", name: "", memberIds: [p.from, p.to], createdAt: Date.now(), encrypted: true } });
      }
    });
  }
}

export function startSimulation(): () => void {
  const unsub = onEvent((ev) => {
    if (ev.type === "message:new") {
      const { message } = ev.payload as EventPayloads["message:new"];
      if (message.trivia) handleTrivia(message);
      else if (isHumanId(message.authorId)) handleHumanMessage(message);
    }
    if (ev.type === "friend:update") onFriendUpdate(ev.payload as EventPayloads["friend:update"]);
  });

  let alive = true;
  const loop = (fn: () => void, min: number, max: number) => {
    const run = () => {
      if (!alive) return;
      try {
        if (S().sessionUserId || Object.values(db().users).some((u: User) => !u.isBot && u.status !== "offline")) fn();
      } catch (err) {
        console.warn("[sim]", err);
      }
      later(rand(min, max), run);
    };
    later(rand(min, max), run);
  };
  loop(ambientTick, 5000, 11000);
  loop(presenceTick, 12000, 24000);
  // ensure the assistant is always online
  setStatus(ASSISTANT_ID, "online");

  return () => {
    alive = false;
    unsub();
    timers.forEach(clearTimeout);
    timers.clear();
  };
}
