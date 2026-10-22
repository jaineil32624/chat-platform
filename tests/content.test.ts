import { describe, expect, it } from "vitest";
import { isJumboEmoji, renderMarkdown } from "@/lib/markdown";
import { calc, offlineAssistantReply } from "@/lib/sim/assistant";
import { detectIntent, generateReply, voice } from "@/lib/sim/replies";
import { generateBots, PERSONAS } from "@/lib/sim/personas";
import { offlineTranslate } from "@/lib/translate";
import { buildSeed } from "@/lib/seed";
import type { User } from "@/lib/types";

describe("markdown", () => {
  it("escapes HTML (no XSS)", () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)"> **hi**');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("<strong>hi</strong>");
  });

  it("renders code without formatting inside it", () => {
    expect(renderMarkdown("`**not bold**`")).toBe("<code>**not bold**</code>");
  });

  it("renders spoilers, links and mentions", () => {
    const users = { u: { id: "u", username: "ava", displayName: "Ava Chen" } as User };
    const out = renderMarkdown("||secret|| https://pulse.dev hi @ava", { users });
    expect(out).toContain('class="spoiler"');
    expect(out).toContain('href="https://pulse.dev"');
    expect(out).toContain('data-user="u"');
  });

  it("detects jumbo emoji messages", () => {
    expect(isJumboEmoji("🔥")).toBe(true);
    expect(isJumboEmoji("🔥🔥🔥")).toBe(true);
    expect(isJumboEmoji("🔥 nice")).toBe(false);
    expect(isJumboEmoji("🔥🔥🔥🔥")).toBe(false);
  });
});

describe("assistant", () => {
  it("evaluates arithmetic safely", () => {
    expect(calc("12*(4+3)")).toBe(84);
    expect(calc("2^10")).toBe(1024);
    expect(calc("-3+5")).toBe(2);
    expect(calc("alert(1)")).toBeNull();
    expect(calc("1/0")).toBeNull();
  });

  it("answers help and math offline", () => {
    expect(offlineAssistantReply("help", "Sam")).toContain("/poll");
    expect(offlineAssistantReply("what is 6*7", "Sam")).toContain("42");
  });
});

describe("bot simulation", () => {
  it("generates 50+ unique, deterministic bots", () => {
    const a = generateBots();
    const b = generateBots();
    expect(a.length).toBeGreaterThanOrEqual(50);
    expect(new Set(a.map((u) => u.id)).size).toBe(a.length);
    expect(a.map((u) => u.displayName)).toEqual(b.map((u) => u.displayName));
    expect(new Set(a.map((u) => u.persona)).size).toBe(PERSONAS.length);
  });

  it("detects intents", () => {
    expect(detectIntent("hey there")).toBe("greeting");
    expect(detectIntent("want to play valorant?")).toBe("gaming");
    expect(detectIntent("ugh I'm so stressed")).toBe("sad");
  });

  it("produces non-empty replies in the persona's voice", () => {
    for (let i = 0; i < 50; i++) expect(generateReply({ text: "hello!", authorName: "Sam", botName: "Bot", personaKey: "gamer" }).length).toBeGreaterThan(0);
    const gamer = PERSONAS.find((p) => p.key === "gamer")!;
    expect(voice("HELLO THERE", gamer, () => 0.99)).toBe("hello there");
  });
});

describe("seed data", () => {
  const seed = buildSeed(Date.UTC(2026, 0, 1));

  it("creates communities with channels and history", () => {
    expect(Object.keys(seed.servers).length).toBeGreaterThanOrEqual(10);
    for (const s of Object.values(seed.servers)) {
      expect(s.channelIds.every((c) => seed.channels[c])).toBe(true);
      expect(s.memberIds.length).toBeGreaterThan(0);
    }
    const textChannels = Object.values(seed.channels).filter((c) => c.kind !== "voice");
    expect(textChannels.every((c) => (seed.messages[c.id] ?? []).length > 0)).toBe(true);
  });
});

describe("translation", () => {
  it("translates known words offline and keeps casing", () => {
    expect(offlineTranslate("Hello friend, thank you!", "es")).toBe("Hola amigo, gracias!");
  });
});
