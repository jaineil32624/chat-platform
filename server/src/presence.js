/**
 * Presence tracking: per workspace, userId -> number of connected sockets.
 * A user is "online" in a workspace while they have at least one socket there,
 * so multiple tabs/devices do not flap presence.
 */

/**
 * @param {{ now?: () => number }} [options] `now` returns epoch ms (injectable for tests).
 */
export function createPresence({ now = () => Date.now() } = {}) {
  /** @type {Map<string, Map<string, number>>} workspace -> (userId -> socketCount) */
  const workspaces = new Map();
  /** @type {Map<string, Map<string, number>>} workspace -> (userId -> last seen epoch ms) */
  const lastSeenByWorkspace = new Map();

  function touch(workspace, userId, ts) {
    let seen = lastSeenByWorkspace.get(workspace);
    if (!seen) {
      seen = new Map();
      lastSeenByWorkspace.set(workspace, seen);
    }
    seen.set(userId, ts);
  }

  return {
    /**
     * Register one socket for a user.
     * @returns {{ firstConnection: boolean, count: number }}
     */
    add(workspace, userId) {
      let users = workspaces.get(workspace);
      if (!users) {
        users = new Map();
        workspaces.set(workspace, users);
      }
      const count = (users.get(userId) ?? 0) + 1;
      users.set(userId, count);
      touch(workspace, userId, now());
      return { firstConnection: count === 1, count };
    },

    /**
     * Unregister one socket for a user. Removing an unknown user is a no-op.
     * @returns {{ lastDisconnection: boolean, count: number, lastSeen: number }}
     */
    remove(workspace, userId) {
      const users = workspaces.get(workspace);
      const current = users?.get(userId) ?? 0;
      const ts = now();
      if (!users || current === 0) {
        return { lastDisconnection: false, count: 0, lastSeen: ts };
      }
      touch(workspace, userId, ts);
      const count = current - 1;
      if (count === 0) {
        users.delete(userId);
        if (users.size === 0) workspaces.delete(workspace);
      } else {
        users.set(userId, count);
      }
      return { lastDisconnection: count === 0, count, lastSeen: ts };
    },

    /** Online userIds in a workspace. */
    list(workspace) {
      return [...(workspaces.get(workspace)?.keys() ?? [])];
    },

    isOnline(workspace, userId) {
      return (workspaces.get(workspace)?.get(userId) ?? 0) > 0;
    },

    socketCount(workspace, userId) {
      return workspaces.get(workspace)?.get(userId) ?? 0;
    },

    /** Epoch ms of the last connect/disconnect seen for the user, or null. */
    lastSeen(workspace, userId) {
      return lastSeenByWorkspace.get(workspace)?.get(userId) ?? null;
    },

    /** Workspaces that currently have at least one online user. */
    workspaces() {
      return [...workspaces.keys()];
    },
  };
}
