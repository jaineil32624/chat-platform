# Contributing

Thanks for your interest in Pulse!

## Setup

```bash
cd client && npm install && npm run dev
cd server && npm install && npm run dev   # optional realtime relay
```

## Conventions

- **TypeScript strict.** Run `npm run typecheck` before pushing.
- **State changes go through events.** Add a `TransportEventType`, handle it in `applyEvent()` (`client/src/lib/store/reducer.ts`), and add a test in `tests/reducer.test.ts`.
- **Selectors return stable references.** Use `EMPTY` from `lib/utils` instead of `?? []`, and derive arrays with `useMemo`.
- **Styling** uses Tailwind and the design tokens in `globals.css`. Don't hard-code colors, so themes keep working.
- **Commits** follow a short imperative summary ("Add poll expiry"), with a body explaining *why* when it isn't obvious.

## Tests

```bash
cd client
npm test
npm run build && NODE_PATH="$PWD/node_modules" npx playwright test
cd ../server && npm test
```

## Pull requests

Fill in the PR template, keep changes focused, and include screenshots for UI changes.
