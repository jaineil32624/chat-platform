import { describe, expect, it } from "vitest";
import { applyEvent, dmChannelId, emptyDB, isMuted, searchMessages, unreadCount, MAX_MESSAGES_PER_CHANNEL, type DB } from "@/lib/store/reducer";
import type { Message, TransportEventType } from "@/lib/types";

const msg = (id: string, over: Partial<Message> = {}): Message => ({ id, channelId: "c1", authorId: "u1", kind: "text", content: `hello ${id}`, createdAt: Number(id.replace(/\D/g, "")) || 1, status: "sent", ...over });
const ev = (type: TransportEventType, payload: unknown) => ({ type, payload });
const withMessages = (...ms: Message[]) => ms.reduce<DB>((db, m) => applyEvent(db, ev("message:new", { message: m })), emptyDB());

describe("reducer: messages", () => {
  it("appends messages and ignores duplicates (idempotent delivery)", () => {
    let db = withMessages(msg("m1"));
    const same = applyEvent(db, ev("message:new", { message: msg("m1") }));
    expect(same).toBe(db);
    db = applyEvent(db, ev("message:new", { message: msg("m2") }));
    expect(db.messages.c1.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("re-sorts out-of-order arrivals", () => {
    const db = withMessages(msg("m5"), msg("m3"));
    expect(db.messages.c1.map((m) => m.id)).toEqual(["m3", "m5"]);
  });

  it("caps history per channel", () => {
    const many = Array.from({ length: MAX_MESSAGES_PER_CHANNEL + 25 }, (_, i) => msg(`m${i + 1}`));
    const db = withMessages(...many);
    expect(db.messages.c1).toHaveLength(MAX_MESSAGES_PER_CHANNEL);
    expect(db.messages.c1[0].id).toBe("m26");
  });

  it("only moves delivery status forward", () => {
    let db = withMessages(msg("m1"));
    db = applyEvent(db, ev("message:update", { channelId: "c1", id: "m1", patch: { status: "read", readBy: ["u2"] } }));
    db = applyEvent(db, ev("message:update", { channelId: "c1", id: "m1", patch: { status: "delivered", readBy: ["u3"] } }));
    expect(db.messages.c1[0].status).toBe("read");
    expect(db.messages.c1[0].readBy).toEqual(["u2", "u3"]);
  });

  it("soft-deletes by blanking content", () => {
    let db = withMessages(msg("m1", { reactions: { "👍": ["u2"] } }));
    db = applyEvent(db, ev("message:delete", { channelId: "c1", id: "m1" }));
    expect(db.messages.c1[0].deletedAt).toBeTypeOf("number");
    expect(db.messages.c1[0].content).toBe("");
    expect(db.messages.c1[0].reactions).toEqual({});
  });

  it("toggles reactions and removes empty buckets", () => {
    let db = withMessages(msg("m1"));
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "🔥", userId: "u2" }));
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "🔥", userId: "u3" }));
    expect(db.messages.c1[0].reactions?.["🔥"]).toEqual(["u2", "u3"]);
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "🔥", userId: "u2" }));
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "🔥", userId: "u3" }));
    expect(db.messages.c1[0].reactions).toEqual({});
    // forced "on" is idempotent
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "👍", userId: "u2", on: true }));
    db = applyEvent(db, ev("reaction:toggle", { channelId: "c1", id: "m1", emoji: "👍", userId: "u2", on: true }));
    expect(db.messages.c1[0].reactions?.["👍"]).toEqual(["u2"]);
  });
});

describe("reducer: polls", () => {
  const poll = (multi: boolean) => msg("m1", { kind: "poll", poll: { question: "Q", multi, options: [{ id: "a", label: "A", votes: [] }, { id: "b", label: "B", votes: [] }] } });

  it("single-choice polls move the vote", () => {
    let db = withMessages(poll(false));
    db = applyEvent(db, ev("poll:vote", { channelId: "c1", id: "m1", optionId: "a", userId: "u1" }));
    db = applyEvent(db, ev("poll:vote", { channelId: "c1", id: "m1", optionId: "b", userId: "u1" }));
    expect(db.messages.c1[0].poll!.options.map((o) => o.votes)).toEqual([[], ["u1"]]);
  });

  it("multi-choice polls keep both", () => {
    let db = withMessages(poll(true));
    db = applyEvent(db, ev("poll:vote", { channelId: "c1", id: "m1", optionId: "a", userId: "u1" }));
    db = applyEvent(db, ev("poll:vote", { channelId: "c1", id: "m1", optionId: "b", userId: "u1" }));
    expect(db.messages.c1[0].poll!.options.map((o) => o.votes)).toEqual([["u1"], ["u1"]]);
  });
});

describe("reducer: social & moderation", () => {
  it("mirrors friend requests on both sides", () => {
    let db = applyEvent(emptyDB(), ev("friend:update", { from: "a", to: "b", state: "outgoing" }));
    expect(db.friends.a.b).toBe("outgoing");
    expect(db.friends.b.a).toBe("incoming");
    db = applyEvent(db, ev("friend:update", { from: "b", to: "a", state: "friends" }));
    expect(db.friends.a.b).toBe("friends");
    db = applyEvent(db, ev("friend:update", { from: "a", to: "b", state: "none" }));
    expect(db.friends.a.b).toBeUndefined();
    expect(db.friends.b.a).toBeUndefined();
  });

  it("applies mutes with expiry and bans", () => {
    const now = Date.now();
    let db = applyEvent(emptyDB(), ev("moderation", { action: { id: "x1", userId: "u", moderatorId: "m", kind: "mute", reason: "spam", createdAt: now, expiresAt: now + 1000 } }));
    expect(isMuted(db, "u", now)).toBe(true);
    expect(isMuted(db, "u", now + 2000)).toBe(false);
    db = applyEvent(db, ev("moderation", { action: { id: "x2", userId: "u", moderatorId: "m", kind: "ban", reason: "abuse", createdAt: now } }));
    expect(db.bans.u).toBe("abuse");
    db = applyEvent(db, ev("moderation", { action: { id: "x3", userId: "u", moderatorId: "m", kind: "unban", reason: "", createdAt: now } }));
    expect(db.bans.u).toBeUndefined();
    expect(db.moderation).toHaveLength(3);
  });
});

describe("queries", () => {
  it("builds stable DM ids regardless of order", () => {
    expect(dmChannelId("b", "a")).toBe(dmChannelId("a", "b"));
  });

  it("counts unread messages from others after last read", () => {
    let db = withMessages(msg("m1", { authorId: "u2" }), msg("m2", { authorId: "me" }), msg("m3", { authorId: "u2" }));
    expect(unreadCount(db, "me", "c1")).toBe(2);
    db = { ...db, readState: { me: { c1: 1 } } };
    expect(unreadCount(db, "me", "c1")).toBe(1);
  });

  it("searches by terms, author and attachment type", () => {
    const db = withMessages(
      msg("m1", { content: "Pizza night tonight?" }),
      msg("m2", { content: "pizza is life", authorId: "u2" }),
      msg("m3", { content: "check this out https://example.com" }),
      msg("m4", { content: "", attachments: [{ id: "a", kind: "image", name: "cat.png", size: 1, mime: "image/png", url: "x" }] }),
    );
    expect(searchMessages(db, "pizza").map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(searchMessages(db, "pizza", { authorId: "u2" }).map((m) => m.id)).toEqual(["m2"]);
    expect(searchMessages(db, "", { has: "link" }).map((m) => m.id)).toEqual(["m3"]);
    expect(searchMessages(db, "cat", { has: "image" }).map((m) => m.id)).toEqual(["m4"]);
  });
});
