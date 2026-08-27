# Training Tracker

A mobile-first training tracker — plan workouts, log sessions, track history —
built on Zoho Catalyst.

Full product spec: [`zoho_catalyst_training_tracker_claude_prompt.md`](./zoho_catalyst_training_tracker_claude_prompt.md).

## Status

**Phase 1 — Foundation** is in progress. Frontend shell, auth wiring, backend
API skeleton, and the first four Data Store tables exist. Authentication is
not yet enabled on the Catalyst project (see "Enabling Authentication"
below) — until it is, the app always shows the sign-in screen.

Later phases (exercise library, plan CRUD, workout logging, history, JSON
import/export, rest timer, offline sync) are designed but not built yet.

## Architecture

- **Client** (`client/`): React + TypeScript + Vite, deployed as a Catalyst
  Web Client (static hosting). Bottom-nav shell (Home / Workout / History /
  Exercises / More), React Router, TanStack Query for data fetching, and
  `vite-plugin-pwa` for an installable PWA manifest + service worker.
- **API** (`functions/api`): a single Node.js Advanced I/O function
  (Express), reachable from the client at `/server/api/*`. This is the only
  thing that talks to the Data Store for user-owned data.
- **Data Store**: Catalyst tables, one row per record, `user_id` columns
  identifying ownership.
- **Authentication**: Catalyst embedded email/password auth. No custom
  username/password implementation.

### Identity — the one rule that matters

**The frontend never sends a `userId`, and the backend never trusts one if it
did.** Every request into `functions/api` derives the caller's identity
server-side via `getCurrentUser(req)` (`functions/api/src/getCurrentUser.js`),
which wraps the Catalyst Node SDK's
`catalyst.initialize(req).userManagement().getCurrentUser()`. All data-access
code must go through this — never read an identity from the request body or
query string.

### Auth wiring (and why it looks the way it does)

A previous attempt to enable Catalyst embedded authentication on this project
caused a login/redirect loop. The client-side auth code here is deliberately
structured to avoid that:

- `client/src/auth/AuthProvider.tsx` is the **only** place auth state is
  checked. It exposes `{ isLoading, isAuthenticated, user }` and nothing
  redirects while `isLoading` is true — that race (guarding before the
  Catalyst SDK resolves the session) was the likely cause of the loop.
- `client/src/auth/RequireAuth.tsx` is the only route guard; nothing else in
  the tree performs its own auth check.
- `client/src/pages/Login.tsx` mounts the embedded sign-in widget **exactly
  once** per page load (guarded with a ref) and does not poll or re-mount it.
- The Catalyst SDK scripts (`client/index.html`) — `catalystWebSDK.js` and
  `/__catalyst/sdk/init.js` — only resolve when the app is served through
  Catalyst itself (`catalyst serve` locally, or once deployed). A bare
  `vite dev` server will 404 on `init.js`; that's expected, not a bug.

## Development

Requires the Catalyst CLI (`npm install -g zcatalyst-cli`) logged in with
access to the `Training-Tracker` project (org `20117369913`).

```bash
cd client && npm install
cd ../functions/api && npm install
```

Run everything locally through Catalyst (never through a bare `vite dev` —
see the auth note above):

```bash
cd client && npm run build   # rebuild after any client change
catalyst serve --http 6001
```

This serves the client at `http://localhost:6001/app/` and the API at
`http://localhost:6001/server/api/`. The local emulator requires an installed
Node runtime matching the function's declared stack — `functions/api/catalyst-config.json`
is set to `node24` to match this machine; adjust if your Node version differs.

`catalyst serve` watches the API function's source and reloads it
automatically. The client is served from its built `dist/` output, so rerun
`npm run build` after client changes (no live-reload yet).

## Enabling Authentication

Not done yet — this is a deliberate checkpoint, not an oversight. Before
enabling embedded email/password authentication in the Catalyst console for
this project, double-check the registered sign-in redirect domain exactly
matches the project's real domain
(`https://training-tracker-20117369913.development.catalystserverless.eu`,
no trailing slash), and test through `catalyst serve` — never a bare `vite dev`
server — per the auth note above.

## Data Store (Phase 1 subset)

Four tables exist so far, enough to prove the auth → API → Data Store path
end-to-end: `TrainingPlan`, `Exercise`, `WorkoutSession`, `UserPreferences`.
Relations between tables are stored as plain ROWID-reference columns (e.g.
`WorkoutSession.plan_id`), not native Catalyst foreign-key columns, and are
enforced at the `functions/api` layer rather than by the database — this
keeps delete/soft-delete behavior (plans must never destroy historical
sessions) predictable and explicit. The full table set (`PlanWorkout`,
`PlanExercise`, `PlanSet`, `ExerciseAlias`, `SessionExercise`, `SessionSet`,
`BodyMeasurement`) is added in later phases as their features are built.

## Known limitations (Phase 1)

- No actual product features yet (plans, workouts, history) — the frontend
  is a shell that proves the foundation works, per the phased build plan in
  the product spec.
- The PWA service worker registration hasn't been verified in a real mobile
  browser yet (only checked in an automated browser pane, which may restrict
  Service Worker APIs regardless of app correctness).
- Offline resilience for active workouts (Phase 7) is not built.
