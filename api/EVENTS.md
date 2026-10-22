# Pulse realtime event protocol

This is the wire protocol between Pulse clients and the Socket.IO relay in `server/`.

The relay checks the **envelope** of each event (see [Server validation](#server-validation)). It never inspects the **payload**: payloads go to peers unchanged. The payload shapes below are the contract between clients. Payload keys are camelCase because these are TypeScript-facing objects. REST and the database use snake_case. The [mapping](#mapping-to-rest--db) section shows how the two correspond.

## Envelope

```ts
type TransportEvent = {
  id: string;         // unique per event, 1–128 chars (uuid / nanoid). Use it for de-duplication.
  type: EventType;
  payload: unknown;   // required; use null when there is nothing to send
  origin: string;     // sender's client id (the clientId given in the handshake), 1–128 chars
  ts: number;         // epoch milliseconds at the sender
  workspace?: string; // optional; if present it MUST equal the socket's workspace
};

type EventType =
  | 'message:new' | 'message:update' | 'message:delete'
  | 'reaction:toggle' | 'typing' | 'presence'
  | 'channel:upsert' | 'server:upsert' | 'user:upsert'
  | 'friend:update' | 'moderation' | 'poll:vote'
  | 'whiteboard:stroke' | 'whiteboard:clear';
```

## Connection

```ts
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
  auth: { clientId, userId, workspace }, // workspace defaults to "public"
});

socket.on('event', (e: TransportEvent) => { /* apply unless e.origin === clientId */ });
socket.on('presence:snapshot', ({ userIds }: { userIds: string[] }) => { /* seed online list */ });
socket.on('error:invalid_event', ({ id, error }) => { /* id may be null */ });
socket.on('error:rate_limited', ({ id, retryAfterMs, limit }) => { /* back off */ });

socket.emit('event', evt);                                        // fire and forget
const ack = await socket.timeout(5000).emitWithAck('event', evt); // or with an ack
// ack: { ok: true } | { ok: false, code: 'invalid_event' | 'rate_limited', error: string, retryAfterMs?: number }
```

| Handshake field | Required | Rules |
| --- | --- | --- |
| `clientId` | recommended | 1–128 chars. Identifies one tab or device. Falls back to the socket id. |
| `userId` | for presence | 1–128 chars. Without it the socket has no presence. |
| `workspace` | no | `/^[A-Za-z0-9_.:-]{1,64}$/`. Invalid or missing values fall back to `"public"`. |

### Delivery semantics

- An event goes to **every other socket in the same workspace**. The sender does not receive its own event back, so apply it optimistically.
- Other tabs belonging to the same user do receive it. Each tab has its own `clientId`.
- Delivery is at most once and there is no replay. A client that reconnects should refetch state over REST or Supabase. De-duplicate by `id`.
- Order is preserved per sender, but there is no global order across senders. For conflicts, use `ts` together with the entity's own `updatedAt`.

## Server validation

| Check | Rule | On failure |
| --- | --- | --- |
| Shape | Object with `id`, `type`, `payload`, `origin` and `ts`, matching the types above | `error:invalid_event` |
| Type | One of the 14 `EventType`s | `error:invalid_event` |
| Size | Serialized JSON of at most 256 KiB | `error:invalid_event`. Above about 272 KiB Socket.IO closes the connection. |
| Workspace | `workspace`, when present, equals the connection's workspace | `error:invalid_event` |
| Rate | Token bucket per socket: 20 events/s, burst of 40 | Event dropped, plus `error:rate_limited` (at most one notice per second) |

## Server-originated events

| Event | Payload | Sent when |
| --- | --- | --- |
| `presence:snapshot` | `{ userIds: string[] }` | Once, to each new socket. Includes the socket's own user. |
| `event` with `type: 'presence'` | `PresencePayload` with `origin: "server"` | A user's **first** socket joins the workspace (`online`), or their **last** socket leaves (`offline`) |
| `error:invalid_event` | `{ id: string \| null, error: string }` | Validation failed |
| `error:rate_limited` | `{ id: string \| null, retryAfterMs: number, limit: { ratePerSec: number, burst: number } }` | Rate limit exceeded |

---

## Event reference

Each entry below gives the payload type and one complete example envelope. Shared types:

```ts
type ID = string;           // uuid
type ISODate = string;      // ISO-8601
type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';
type ChannelKind = 'dm' | 'group_dm' | 'text' | 'voice' | 'announcement';
type MessageKind = 'text' | 'gif' | 'sticker' | 'voice' | 'poll' | 'trivia' | 'system';
type MessageStatus = 'scheduled' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

type Attachment = {
  id: string; name: string; url: string; contentType: string; size: number;
  width?: number; height?: number; durationMs?: number;
};

type Message = {
  id: ID; channelId: ID; serverId: ID | null; authorId: ID | null;
  kind: MessageKind; status: MessageStatus;
  content: string; ciphertext?: string | null;
  attachments: Attachment[]; metadata: Record<string, unknown>;
  mentions: ID[]; mentionEveryone?: boolean;
  replyTo: ID | null; threadParentId: ID | null;
  pinned: boolean; scheduledFor: ISODate | null;
  editedAt: ISODate | null; deletedAt: ISODate | null;
  createdAt: ISODate;
};
```

### `message:new`

A message was created. The payload is the full message.

```ts
type MessageNewPayload = { message: Message; nonce?: string /* optimistic id to reconcile */ };
```

```json
{
  "id": "evt_01HZX3K9Q7",
  "type": "message:new",
  "origin": "client_8f2c",
  "ts": 1761170400000,
  "workspace": "public",
  "payload": {
    "nonce": "tmp_4821",
    "message": {
      "id": "6a1f0c2e-7d1b-4f0e-9a51-3c1b2b6f9e10",
      "channelId": "dddddddd-0000-4000-8000-000000000003",
      "serverId": "aaaaaaaa-0000-4000-8000-000000000001",
      "authorId": "11111111-1111-4111-8111-111111111111",
      "kind": "text",
      "status": "sent",
      "content": "Ship it 🚀 <@22222222-2222-4222-8222-222222222222>",
      "attachments": [],
      "metadata": {},
      "mentions": ["22222222-2222-4222-8222-222222222222"],
      "replyTo": null,
      "threadParentId": null,
      "pinned": false,
      "scheduledFor": null,
      "editedAt": null,
      "deletedAt": null,
      "createdAt": "2025-10-22T22:00:00.000Z"
    }
  }
}
```

For other kinds, put the kind-specific data in `metadata`:

| `kind` | `metadata` example |
| --- | --- |
| `gif` | `{ "gif": { "url": "https://media.giphy.com/…/giphy.gif", "provider": "giphy", "width": 480, "height": 270 } }` |
| `sticker` | `{ "sticker": { "id": "wave", "name": "Wave", "url": "/stickers/wave.webp" } }` |
| `voice` | `{ "voice": { "durationMs": 7400, "waveform": [2,5,9,7,4] } }` plus one `audio/webm` attachment |
| `poll` | `{ "poll": { "id": "<poll id>", "question": "…", "options": [{ "id": "a", "label": "…" }], "allowsMultiple": false, "isAnonymous": false, "closesAt": null } }` |
| `trivia` | `{ "trivia": { "choices": ["Jupiter","Saturn"], "answerIndex": 1, "explanation": "…" } }` |
| `system` | `{ "event": "member_join", "userId": "…" }` |
| E2EE | `content: ""`, `ciphertext: "<base64>"`, `metadata.encryption: { "alg": "x25519-xsalsa20-poly1305", "nonce": "…" }` |

### `message:update`

An edit, a pin or unpin, or a status change such as `delivered` or `read`. The payload is a partial patch. Only `id` and `channelId` are required.

```ts
type MessageUpdatePayload = {
  id: ID; channelId: ID;
  patch: Partial<Pick<Message, 'content' | 'ciphertext' | 'attachments' | 'metadata' | 'mentions' | 'pinned' | 'status' | 'editedAt' | 'scheduledFor'>>;
};
```

```json
{
  "id": "evt_01HZX3M2B1",
  "type": "message:update",
  "origin": "client_8f2c",
  "ts": 1761170460000,
  "payload": {
    "id": "6a1f0c2e-7d1b-4f0e-9a51-3c1b2b6f9e10",
    "channelId": "dddddddd-0000-4000-8000-000000000003",
    "patch": { "content": "Ship it 🚀 (after QA)", "editedAt": "2025-10-22T22:01:00.000Z" }
  }
}
```

### `message:delete`

A soft delete. Clients should show a tombstone or remove the message.

```ts
type MessageDeletePayload = { id: ID; channelId: ID; deletedBy: ID; deletedAt: ISODate };
```

```json
{
  "id": "evt_01HZX3N7RW",
  "type": "message:delete",
  "origin": "client_a1b2",
  "ts": 1761170520000,
  "payload": {
    "id": "6a1f0c2e-7d1b-4f0e-9a51-3c1b2b6f9e10",
    "channelId": "dddddddd-0000-4000-8000-000000000003",
    "deletedBy": "22222222-2222-4222-8222-222222222222",
    "deletedAt": "2025-10-22T22:02:00.000Z"
  }
}
```

### `reaction:toggle`

```ts
type ReactionTogglePayload = { messageId: ID; channelId: ID; userId: ID; emoji: string; added: boolean };
```

```json
{
  "id": "evt_01HZX3P0D4",
  "type": "reaction:toggle",
  "origin": "client_c3d4",
  "ts": 1761170530000,
  "payload": {
    "messageId": "6a1f0c2e-7d1b-4f0e-9a51-3c1b2b6f9e10",
    "channelId": "dddddddd-0000-4000-8000-000000000003",
    "userId": "33333333-3333-4333-8333-333333333333",
    "emoji": "🔥",
    "added": true
  }
}
```

### `typing`

Send at most one every 3 seconds while the user is typing. Receivers should expire an indicator after about 8 seconds without a refresh. `isTyping: false` clears it immediately, for example on send or blur.

```ts
type TypingPayload = { channelId: ID; userId: ID; isTyping: boolean; threadParentId?: ID | null };
```

```json
{
  "id": "evt_01HZX3Q8JK",
  "type": "typing",
  "origin": "client_c3d4",
  "ts": 1761170540000,
  "payload": { "channelId": "dddddddd-0000-4000-8000-000000000003", "userId": "33333333-3333-4333-8333-333333333333", "isTyping": true }
}
```

### `presence`

The **server** emits this on the first connect and the last disconnect, with `status` set to `online` or `offline`. Clients may also send `presence` to announce `idle` or `dnd`, or a custom status.

```ts
type PresencePayload = {
  userId: ID;
  status: PresenceStatus;   // server only ever sends 'online' | 'offline'
  lastSeen: number;         // epoch ms
  customStatus?: string | null;
};
```

Server-originated:

```json
{
  "id": "4b0d8f8e-2c55-4a8e-9b6e-6f7f0e4c2a11",
  "type": "presence",
  "origin": "server",
  "ts": 1761170550000,
  "workspace": "public",
  "payload": { "userId": "22222222-2222-4222-8222-222222222222", "status": "offline", "lastSeen": 1761170550000 }
}
```

Client-originated:

```json
{
  "id": "evt_01HZX3R1AA",
  "type": "presence",
  "origin": "client_8f2c",
  "ts": 1761170560000,
  "payload": { "userId": "11111111-1111-4111-8111-111111111111", "status": "dnd", "lastSeen": 1761170560000, "customStatus": "Focus mode" }
}
```

### `channel:upsert`

A channel was created or updated. The payload is the full channel. Set `deleted: true` to remove it.

```ts
type Channel = {
  id: ID; serverId: ID | null; categoryId: ID | null; kind: ChannelKind;
  name: string | null; topic: string | null; position: number;
  isPrivate: boolean; isNsfw: boolean; slowmodeSeconds: number;
  memberIds?: ID[];   // DMs / group DMs / private channels
  lastMessageAt: ISODate | null; updatedAt: ISODate;
};
type ChannelUpsertPayload = { channel: Channel; deleted?: boolean };
```

```json
{
  "id": "evt_01HZX3S5TT",
  "type": "channel:upsert",
  "origin": "client_8f2c",
  "ts": 1761170570000,
  "payload": {
    "channel": {
      "id": "0f7f2f6a-5d4e-4b7a-8a0d-1f2e3d4c5b6a",
      "serverId": "aaaaaaaa-0000-4000-8000-000000000001",
      "categoryId": "cccccccc-0000-4000-8000-000000000001",
      "kind": "text",
      "name": "design",
      "topic": "Mockups and feedback",
      "position": 2,
      "isPrivate": false,
      "isNsfw": false,
      "slowmodeSeconds": 0,
      "lastMessageAt": null,
      "updatedAt": "2025-10-22T22:02:50.000Z"
    }
  }
}
```

### `server:upsert`

A server or one of its roles changed. Send `roles` only when they changed.

```ts
type Role = { id: ID; name: string; color: string | null; position: number; permissions: number; isDefault: boolean; hoist: boolean; mentionable: boolean };
type ServerUpsertPayload = {
  server: { id: ID; name: string; description: string | null; iconUrl: string | null; ownerId: ID; isPublic: boolean; updatedAt: ISODate };
  roles?: Role[];
  memberIds?: { added?: ID[]; removed?: ID[] };
  deleted?: boolean;
};
```

```json
{
  "id": "evt_01HZX3T9MM",
  "type": "server:upsert",
  "origin": "client_8f2c",
  "ts": 1761170580000,
  "payload": {
    "server": {
      "id": "aaaaaaaa-0000-4000-8000-000000000001",
      "name": "Pulse HQ",
      "description": "Official community for the Pulse chat platform.",
      "iconUrl": null,
      "ownerId": "11111111-1111-4111-8111-111111111111",
      "isPublic": true,
      "updatedAt": "2025-10-22T22:03:00.000Z"
    },
    "roles": [
      { "id": "bbbbbbbb-0000-4000-8000-000000000002", "name": "Moderator", "color": "#0ea5e9", "position": 2, "permissions": 3927, "isDefault": false, "hoist": true, "mentionable": true }
    ],
    "memberIds": { "added": ["44444444-4444-4444-8444-444444444444"] }
  }
}
```

### `user:upsert`

A profile changed. Send only the fields that are public.

```ts
type UserUpsertPayload = {
  user: {
    id: ID; username: string; displayName: string | null; avatarUrl: string | null; bannerUrl?: string | null;
    bio?: string | null; accentColor?: string | null; status?: PresenceStatus; customStatus?: string | null;
    level?: number; xp?: number; updatedAt: ISODate;
  };
};
```

```json
{
  "id": "evt_01HZX3V3PP",
  "type": "user:upsert",
  "origin": "client_c3d4",
  "ts": 1761170590000,
  "payload": {
    "user": {
      "id": "33333333-3333-4333-8333-333333333333",
      "username": "carol",
      "displayName": "Carol D.",
      "avatarUrl": "https://cdn.example.com/avatars/carol.webp",
      "level": 2,
      "xp": 180,
      "updatedAt": "2025-10-22T22:03:10.000Z"
    }
  }
}
```

### `friend:update`

A friend request was sent, accepted, declined or removed, or a user was blocked or unblocked. Both participants care about this event.

```ts
type FriendUpdatePayload = {
  requesterId: ID; addresseeId: ID;
  status: 'pending' | 'accepted' | 'blocked' | 'removed';
  actorId: ID;
};
```

```json
{
  "id": "evt_01HZX3W6QQ",
  "type": "friend:update",
  "origin": "client_8f2c",
  "ts": 1761170600000,
  "payload": {
    "requesterId": "44444444-4444-4444-8444-444444444444",
    "addresseeId": "11111111-1111-4111-8111-111111111111",
    "status": "accepted",
    "actorId": "11111111-1111-4111-8111-111111111111"
  }
}
```

Do not broadcast `blocked` to the blocked user. Clients should send it only to the blocker's own other tabs, or skip it.

### `moderation`

A warn, mute, kick or ban was applied, or a sanction was revoked. Clients disable the composer for muted users and remove kicked or banned users from member lists.

```ts
type ModerationPayload = {
  id: ID; serverId: ID; targetUserId: ID; moderatorId: ID;
  action: 'warn' | 'mute' | 'kick' | 'ban' | 'unmute' | 'unban';
  reason?: string | null;
  expiresAt?: ISODate | null;
  deleteMessageIds?: ID[];   // optional purge on ban
};
```

```json
{
  "id": "evt_01HZX3X8RR",
  "type": "moderation",
  "origin": "client_b0b0",
  "ts": 1761170610000,
  "payload": {
    "id": "99999999-0000-4000-8000-000000000002",
    "serverId": "aaaaaaaa-0000-4000-8000-000000000001",
    "targetUserId": "44444444-4444-4444-8444-444444444444",
    "moderatorId": "22222222-2222-4222-8222-222222222222",
    "action": "mute",
    "reason": "Spam in #random.",
    "expiresAt": "2025-10-22T23:03:30.000Z"
  }
}
```

### `poll:vote`

Send `optionIds` as the voter's **complete** current selection. An empty array retracts the vote. Receivers can recompute tallies locally or show the authoritative `tallies` when the sender includes them.

```ts
type PollVotePayload = {
  pollId: ID; messageId: ID; channelId: ID;
  userId: ID | null;            // null for anonymous polls
  optionIds: string[];
  tallies?: Record<string, number>;
};
```

```json
{
  "id": "evt_01HZX3Y1SS",
  "type": "poll:vote",
  "origin": "client_c3d4",
  "ts": 1761170620000,
  "payload": {
    "pollId": "ffffffff-0000-4000-8000-000000000001",
    "messageId": "eeeeeeee-0000-4000-8000-00000000000b",
    "channelId": "dddddddd-0000-4000-8000-000000000006",
    "userId": "33333333-3333-4333-8333-333333333333",
    "optionIds": ["b"],
    "tallies": { "a": 1, "b": 1, "c": 0 }
  }
}
```

### `whiteboard:stroke`

One stroke, or one chunk of a stroke, on a shared whiteboard. Coordinates are normalized to the range 0–1 so they work at any canvas size. Batch the points of a long stroke into chunks of about 50 ms, all sharing one `strokeId`, so that you stay within the rate limit.

```ts
type WhiteboardStrokePayload = {
  boardId: ID;                // usually the channel id
  strokeId: string;
  userId: ID;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;              // '#rrggbb'
  width: number;              // px at 1x
  points: [number, number, number?][]; // [x, y, pressure?], x/y in 0..1
  final: boolean;             // true on pointer-up
};
```

```json
{
  "id": "evt_01HZX3Z4TT",
  "type": "whiteboard:stroke",
  "origin": "client_8f2c",
  "ts": 1761170630000,
  "payload": {
    "boardId": "dddddddd-0000-4000-8000-000000000003",
    "strokeId": "s_7q2",
    "userId": "11111111-1111-4111-8111-111111111111",
    "tool": "pen",
    "color": "#7c3aed",
    "width": 3,
    "points": [[0.102, 0.233, 0.5], [0.108, 0.241, 0.55], [0.117, 0.250, 0.6]],
    "final": false
  }
}
```

### `whiteboard:clear`

```ts
type WhiteboardClearPayload = { boardId: ID; userId: ID; scope?: 'all' | 'mine' };
```

```json
{
  "id": "evt_01HZX40AUU",
  "type": "whiteboard:clear",
  "origin": "client_8f2c",
  "ts": 1761170640000,
  "payload": { "boardId": "dddddddd-0000-4000-8000-000000000003", "userId": "11111111-1111-4111-8111-111111111111", "scope": "all" }
}
```

---

## Mapping to REST / DB

| Event payload (camelCase) | REST / DB (snake_case) |
| --- | --- |
| `channelId`, `serverId`, `authorId`, `replyTo`, `threadParentId` | `channel_id`, `server_id` (via channel), `author_id`, `reply_to`, `thread_parent_id` |
| `scheduledFor`, `editedAt`, `deletedAt`, `createdAt`, `updatedAt` | `scheduled_for`, `edited_at`, `deleted_at`, `created_at`, `updated_at` |
| `mentionEveryone` | `mention_everyone` |
| `isPrivate`, `isNsfw`, `slowmodeSeconds`, `categoryId`, `lastMessageAt` | `is_private`, `is_nsfw`, `slowmode_seconds`, `category_id`, `last_message_at` |
| `displayName`, `avatarUrl`, `bannerUrl`, `accentColor`, `customStatus` | `display_name`, `avatar_url`, `banner_url`, `accent_color`, `custom_status` |
| `requesterId`, `addresseeId` | `requester_id`, `addressee_id` |
| `targetUserId`, `moderatorId`, `expiresAt` | `target_user_id`, `moderator_id`, `expires_at` |
| `allowsMultiple`, `isAnonymous`, `closesAt` | `allows_multiple`, `is_anonymous`, `closes_at` |
| `permissions` (number) | `roles.permissions` (bigint bitfield, same bits) |

The keys inside `attachments[]` and `metadata` stay camelCase in both places, because they are stored as jsonb unchanged.

## Permission bits

The same bits apply in the client, REST and the database:

```ts
export const Permissions = {
  VIEW_CHANNEL: 1, SEND_MESSAGES: 2, MANAGE_MESSAGES: 4, MANAGE_CHANNELS: 8,
  KICK_MEMBERS: 16, BAN_MEMBERS: 32, MUTE_MEMBERS: 64, MANAGE_ROLES: 128,
  MENTION_EVERYONE: 256, ATTACH_FILES: 512, ADD_REACTIONS: 1024, PIN_MESSAGES: 2048,
  ADMINISTRATOR: 4096,
} as const;
```

> The relay **does not enforce permissions**. It cannot see them, and anyone can emit any event. In a deployment backed by Supabase, the database (RLS) is the source of truth, and receivers should treat relayed events as hints. For example, ignore a `message:delete` from someone who lacks `MANAGE_MESSAGES`, or confirm it through Supabase Realtime.
