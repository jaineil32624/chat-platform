import { describe, expect, it } from "vitest";
import { evaluateAchievements, levelFromXp, levelProgress, nextStreak, reputationTier, xpForLevel } from "@/lib/gamification";

describe("levels", () => {
  it("is the inverse of xpForLevel", () => {
    for (let l = 0; l < 30; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it("reports progress within a level", () => {
    const p = levelProgress(xpForLevel(3) + 10);
    expect(p.level).toBe(3);
    expect(p.current).toBe(10);
    expect(p.pct).toBeGreaterThan(0);
    expect(p.pct).toBeLessThan(1);
  });
});

describe("streaks", () => {
  it("continues on consecutive days and resets after a gap", () => {
    expect(nextStreak(undefined, 0, "2026-01-01")).toEqual({ streak: 1, isNewDay: true });
    expect(nextStreak("2026-01-01", 1, "2026-01-02")).toEqual({ streak: 2, isNewDay: true });
    expect(nextStreak("2026-01-02", 2, "2026-01-02")).toEqual({ streak: 2, isNewDay: false });
    expect(nextStreak("2026-01-02", 5, "2026-01-05")).toEqual({ streak: 1, isNewDay: true });
  });
});

describe("achievements", () => {
  it("returns only newly satisfied achievements", () => {
    const fresh = evaluateAchievements({ messages: 10, reactions: 1, friends: 0, streak: 3, level: 1 }, ["first-message"]);
    expect(fresh).toEqual(expect.arrayContaining(["msg-10", "first-reaction", "streak-3"]));
    expect(fresh).not.toContain("first-message");
    expect(fresh).not.toContain("msg-100");
  });

  it("maps reputation to tiers", () => {
    expect(reputationTier(0).name).toBe("Newcomer");
    expect(reputationTier(150).name).toBe("Trusted");
    expect(reputationTier(10_000).name).toBe("Legend");
  });
});
