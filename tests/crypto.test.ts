import { describe, expect, it } from "vitest";
import { decryptForChannel, encryptForChannel, hashPassword, randomSalt, safetyNumber } from "@/lib/crypto";

describe("crypto", () => {
  it("hashes passwords deterministically per salt", async () => {
    const salt = randomSalt();
    const a = await hashPassword("hunter22", salt);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassword("hunter22", salt)).toBe(a);
    expect(await hashPassword("hunter22", randomSalt())).not.toBe(a);
    expect(await hashPassword("hunter23", salt)).not.toBe(a);
  });

  it("round-trips AES-GCM channel encryption with random IVs", async () => {
    const c1 = await encryptForChannel("meet at 7 🍕", "dm:a:b", ["a", "b"]);
    const c2 = await encryptForChannel("meet at 7 🍕", "dm:a:b", ["b", "a"]);
    expect(c1).not.toBe(c2);
    expect(await decryptForChannel(c1, "dm:a:b", ["b", "a"])).toBe("meet at 7 🍕");
    await expect(decryptForChannel(c1, "dm:a:c", ["a", "c"])).rejects.toBeTruthy();
  });

  it("derives symmetric safety numbers", async () => {
    const ab = await safetyNumber("alice", "bob");
    expect(ab).toHaveLength(12);
    expect(ab.every((g) => /^\d{5}$/.test(g))).toBe(true);
    expect(await safetyNumber("bob", "alice")).toEqual(ab);
  });
});
