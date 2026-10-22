import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { dmChannelId } from "@/lib/store/reducer";
import { ASSISTANT_ID } from "@/lib/sim/personas";

const S = () => useStore.getState();

describe("store integration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    S().resetDemo();
  });

  it("seeds the world on first run", () => {
    expect(Object.keys(S().db.servers).length).toBeGreaterThanOrEqual(10);
    expect(Object.values(S().db.users).filter((u) => u.isBot).length).toBeGreaterThanOrEqual(50);
  });

  it("registers, logs out and logs back in with hashed credentials", async () => {
    const r = await S().register({ email: "Sam@Example.com", password: "secret123", displayName: "Sam", username: "sam", avatarColor: "#7c5cff" });
    expect(r.ok).toBe(true);
    const me = S().sessionUserId!;
    const acct = S().db.accounts["sam@example.com"];
    expect(acct.passwordHash).not.toContain("secret123");
    expect(acct.isAdmin).toBe(true); // first human is admin
    expect(S().db.servers.srv_hq.memberIds).toContain(me);
    S().logout();
    expect(S().sessionUserId).toBeUndefined();
    expect((await S().login("sam@example.com", "wrong")).ok).toBe(false);
    expect((await S().login("sam@example.com", "secret123")).ok).toBe(true);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await S().register({ email: "a@b.co", password: "secret123", displayName: "A", username: "aaa", avatarColor: "#000" });
    expect((await S().register({ email: "a@b.co", password: "secret123", displayName: "B", username: "bbb", avatarColor: "#000" })).ok).toBe(false);
    expect((await S().register({ email: "c@b.co", password: "123", displayName: "C", username: "ccc", avatarColor: "#000" })).ok).toBe(false);
  });

  it("sends messages, awards XP and encrypts DMs", async () => {
    await S().register({ email: "x@y.z", password: "secret123", displayName: "X", username: "xxx", avatarColor: "#000" });
    const me = S().sessionUserId!;
    const before = S().db.users[me].xp;
    await S().sendMessage("srv_hq:general", { content: "hello pulse" });
    expect(S().db.messages["srv_hq:general"].at(-1)?.content).toBe("hello pulse");
    expect(S().db.users[me].xp).toBeGreaterThan(before);
    expect(S().db.stats[me].achievements).toContain("first-message");

    S().openDm("bot_1");
    const dm = dmChannelId(me, "bot_1");
    await S().sendMessage(dm, { content: "secret plans" });
    expect(S().db.messages[dm].at(-1)?.ciphertext).toMatch(/\./);
  });

  it("enforces mutes", async () => {
    await S().register({ email: "m@m.m", password: "secret123", displayName: "M", username: "mmm", avatarColor: "#000" });
    const me = S().sessionUserId!;
    S().moderate(me, "mute", "test", 60_000);
    const n = S().db.messages["srv_hq:general"].length;
    await S().sendMessage("srv_hq:general", { content: "can you hear me" });
    expect(S().db.messages["srv_hq:general"].length).toBe(n);
  });

  it("creates servers from templates with owner permissions", async () => {
    await S().register({ email: "o@o.o", password: "secret123", displayName: "O", username: "ooo", avatarColor: "#000" });
    const id = S().createServer({ name: "Robotics Club", icon: "🤖", color: "#000", description: "", template: "club", isPublic: true });
    const s = S().db.servers[id];
    expect(s.ownerId).toBe(S().sessionUserId);
    expect(s.channelIds.length).toBeGreaterThanOrEqual(3);
    expect(S().db.channels[s.channelIds[0]].kind).toBe("announcement");
  });

  it("opens a welcome DM with the assistant", async () => {
    await S().register({ email: "w@w.w", password: "secret123", displayName: "W", username: "www", avatarColor: "#000" });
    await new Promise((r) => setTimeout(r, 1400));
    const dm = dmChannelId(S().sessionUserId!, ASSISTANT_ID);
    expect(S().db.messages[dm]?.[0]?.authorId).toBe(ASSISTANT_ID);
  });
});
