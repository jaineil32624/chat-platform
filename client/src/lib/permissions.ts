import type { ID, Role, Server } from "./types";

// Bitfield permissions — identical values to database/schema.sql.
export const Perm = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  MANAGE_CHANNELS: 1 << 3,
  KICK_MEMBERS: 1 << 4,
  BAN_MEMBERS: 1 << 5,
  MUTE_MEMBERS: 1 << 6,
  MANAGE_ROLES: 1 << 7,
  MENTION_EVERYONE: 1 << 8,
  ATTACH_FILES: 1 << 9,
  ADD_REACTIONS: 1 << 10,
  PIN_MESSAGES: 1 << 11,
  ADMINISTRATOR: 1 << 12,
} as const;

export type PermKey = keyof typeof Perm;

export const PERM_LABELS: Record<PermKey, string> = {
  VIEW_CHANNEL: "View channels",
  SEND_MESSAGES: "Send messages",
  MANAGE_MESSAGES: "Manage messages",
  MANAGE_CHANNELS: "Manage channels",
  KICK_MEMBERS: "Kick members",
  BAN_MEMBERS: "Ban members",
  MUTE_MEMBERS: "Mute members",
  MANAGE_ROLES: "Manage roles",
  MENTION_EVERYONE: "Mention @everyone",
  ATTACH_FILES: "Attach files",
  ADD_REACTIONS: "Add reactions",
  PIN_MESSAGES: "Pin messages",
  ADMINISTRATOR: "Administrator",
};

export const DEFAULT_MEMBER =
  Perm.VIEW_CHANNEL | Perm.SEND_MESSAGES | Perm.ATTACH_FILES | Perm.ADD_REACTIONS;

export const MODERATOR =
  DEFAULT_MEMBER | Perm.MANAGE_MESSAGES | Perm.MUTE_MEMBERS | Perm.KICK_MEMBERS | Perm.PIN_MESSAGES | Perm.MENTION_EVERYONE;

export const ALL_PERMS = Object.values(Perm).reduce((a, b) => a | b, 0);

export function has(bits: number, perm: number): boolean {
  if (bits & Perm.ADMINISTRATOR) return true;
  return (bits & perm) === perm;
}

export function toggle(bits: number, perm: number): number {
  return bits ^ perm;
}

/** Union of all role permissions a member holds in a server. Owners get everything. */
export function memberPermissions(server: Server, userId: ID): number {
  if (server.ownerId === userId) return ALL_PERMS;
  const everyone = server.roles.find((r) => r.id === `${server.id}:everyone`);
  let bits = everyone?.permissions ?? DEFAULT_MEMBER;
  for (const roleId of server.memberRoles[userId] ?? []) {
    const role = server.roles.find((r) => r.id === roleId);
    if (role) bits |= role.permissions;
  }
  return bits;
}

export function can(server: Server | undefined, userId: ID, perm: number): boolean {
  if (!server) return true; // DMs: participants can do everything
  return has(memberPermissions(server, userId), perm);
}

/** Highest-positioned role with a color — used to tint member names. */
export function topRole(server: Server | undefined, userId: ID): Role | undefined {
  if (!server) return undefined;
  const ids = server.memberRoles[userId] ?? [];
  return server.roles
    .filter((r) => ids.includes(r.id))
    .sort((a, b) => b.position - a.position)[0];
}
