import { describe, expect, it } from "vitest";
import { ALL_PERMS, DEFAULT_MEMBER, MODERATOR, Perm, can, has, memberPermissions, toggle, topRole } from "@/lib/permissions";
import type { Server } from "@/lib/types";

const server: Server = {
  id: "s", name: "S", icon: "x", color: "#000", description: "", ownerId: "owner", memberIds: ["owner", "mod", "member"],
  roles: [
    { id: "s:everyone", name: "@everyone", color: "#999", permissions: DEFAULT_MEMBER, position: 0 },
    { id: "s:mod", name: "Mod", color: "#0f0", permissions: MODERATOR, position: 2 },
    { id: "s:vip", name: "VIP", color: "#f0f", permissions: Perm.PIN_MESSAGES, position: 1 },
  ],
  memberRoles: { mod: ["s:mod", "s:vip"], member: [] },
  categories: [], channelIds: [], isPublic: true, tags: [], createdAt: 0,
};

describe("permissions", () => {
  it("matches the database bit values", () => {
    expect(Perm.VIEW_CHANNEL).toBe(1);
    expect(Perm.ADD_REACTIONS).toBe(1024);
    expect(Perm.ADMINISTRATOR).toBe(4096);
    expect(DEFAULT_MEMBER).toBe(1539);
  });

  it("administrator implies every permission", () => {
    expect(has(Perm.ADMINISTRATOR, Perm.BAN_MEMBERS)).toBe(true);
    expect(has(Perm.SEND_MESSAGES, Perm.BAN_MEMBERS)).toBe(false);
  });

  it("toggles single bits", () => {
    expect(toggle(DEFAULT_MEMBER, Perm.PIN_MESSAGES) & Perm.PIN_MESSAGES).toBeTruthy();
    expect(toggle(toggle(DEFAULT_MEMBER, Perm.PIN_MESSAGES), Perm.PIN_MESSAGES)).toBe(DEFAULT_MEMBER);
  });

  it("unions role permissions and gives owners everything", () => {
    expect(memberPermissions(server, "owner")).toBe(ALL_PERMS);
    expect(can(server, "mod", Perm.MUTE_MEMBERS)).toBe(true);
    expect(can(server, "member", Perm.MUTE_MEMBERS)).toBe(false);
    expect(can(server, "member", Perm.SEND_MESSAGES)).toBe(true);
    expect(can(undefined, "anyone", Perm.BAN_MEMBERS)).toBe(true); // DMs
  });

  it("picks the highest positioned role", () => {
    expect(topRole(server, "mod")?.id).toBe("s:mod");
    expect(topRole(server, "member")).toBeUndefined();
  });
});
