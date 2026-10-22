# Security policy

## Scope

Pulse is an educational **simulation**. Accounts, messages and encryption keys live in the user's browser. The cryptography uses real primitives (PBKDF2, AES-256-GCM via Web Crypto) to show how they fit into a chat product, but the overall system is **not** a secure messenger:

- Conversation keys are derived from public identifiers, not negotiated with a key-exchange protocol.
- Anyone with access to the browser profile can read local data.
- The optional Socket.IO relay trusts client-supplied user ids. See `server/README.md` for how to add JWT verification.

## What is hardened

- Markdown rendering escapes HTML before formatting, with tests in `tests/content.test.ts`.
- Passwords are never stored in plaintext.
- The relay validates event shape and size, rate-limits per socket, and isolates workspaces.
- The Postgres schema enables RLS on every table.

## Reporting a vulnerability

Please open a private security advisory on GitHub (**Security → Report a vulnerability**) rather than a public issue. I'll respond as quickly as possible.
