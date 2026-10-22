# Pulse API contracts

| File | What it describes |
| --- | --- |
| [`openapi.yaml`](./openapi.yaml) | OpenAPI 3.1 REST surface: auth, users, friends, servers, roles, channels, messages (CRUD, threads, reactions, pins, polls), search, moderation, notifications and analytics |
| [`EVENTS.md`](./EVENTS.md) | The Socket.IO realtime protocol (`TransportEvent`) with a payload example for every event type |

## How the pieces fit

```
             REST (openapi.yaml)                         Realtime (EVENTS.md)
client ───────────────────────────▶ Next.js route handlers / Supabase  client ◀──── Socket.IO relay (server/) ────▶ other clients
                                    │ RLS + triggers (database/)
                                    └─ Supabase Realtime (postgres_changes on messages, reactions, typing_indicators, notifications, poll_votes)
```

- **REST** resources match `database/schema.sql`. Field names are the same snake_case columns, and several endpoints map directly onto RPC functions such as `search_messages`, `toggle_reaction`, `join_server_by_invite`, `get_poll_results` and `get_server_analytics`. The REST layer can be built as thin Next.js route handlers that call `supabase-js` with the user's JWT, which keeps RLS in force. Alternatively, the client can call PostgREST directly.
- **Realtime** has two transports:
  - the Socket.IO relay, which is fast, has no database, and covers presence, typing and whiteboard events
  - Supabase Realtime, which is authoritative and filtered by RLS
- **Naming:** REST and the database use snake_case. Realtime event payloads use camelCase. `EVENTS.md` contains a table mapping one to the other.

## Working with the spec

```bash
# Lint
npx @redocly/cli lint api/openapi.yaml

# Browse docs locally
npx @redocly/cli preview-docs api/openapi.yaml

# Generate TypeScript types for the client
npx openapi-typescript api/openapi.yaml -o client/src/types/api.d.ts
```

`redocly lint` reports the spec as valid. The 4 remaining warnings are deliberate: two placeholder server URLs, a 302-only OAuth redirect, and `/health`, which has no 4xx response.

## Conventions

- **Auth:** `Authorization: Bearer <supabase access token>`. The only public endpoints are `/health` and `/auth/*`, apart from `/auth/logout` and `/auth/session`.
- **Errors:** every error returns `{ "error": "<code>", "message": "<human text>", "details"?: {} }` with a matching HTTP status. Typical codes are `validation_failed`, `unauthorized`, `forbidden`, `muted`, `banned`, `not_found`, `conflict` and `rate_limited`.
- **Permissions:** operations that require a permission bit have `x-required-permission`. The bits are VIEW_CHANNEL=1, SEND_MESSAGES=2, MANAGE_MESSAGES=4, MANAGE_CHANNELS=8, KICK_MEMBERS=16, BAN_MEMBERS=32, MUTE_MEMBERS=64, MANAGE_ROLES=128, MENTION_EVERYONE=256, ATTACH_FILES=512, ADD_REACTIONS=1024, PIN_MESSAGES=2048 and ADMINISTRATOR=4096.
- **Pagination:** messages use cursors (`before`, `after`, `around` plus `limit` ≤ 100). Other lists use `limit` and `offset`.
- **Idempotency:** `POST /channels/{id}/messages` accepts an `Idempotency-Key` header. `PUT` endpoints such as reactions, pins, saves and role assignment are idempotent.
- **Visibility:** a resource you cannot see returns `404` rather than `403`, so its existence is not revealed.
