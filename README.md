# Training Tracker

A mobile-first training tracker — plan workouts, log sessions, track history —
built on Zoho Catalyst.

Full product spec: [`zoho_catalyst_training_tracker_claude_prompt.md`](./zoho_catalyst_training_tracker_claude_prompt.md).

## Status

**Phase 1 — Foundation**, **Phase 2 — Exercise Library**, and **Phase 3 —
Plans** are complete and deployed. Embedded email/password authentication is
live and verified end-to-end. Public self-signup is off (console-only
toggle, not flipped by choice yet) — new users are added via Catalyst's Add
User (invite email) for now.

Later phases (workout logging, history, JSON import/export, rest timer,
offline sync) are designed but not built yet.

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

## Authentication

Embedded email/password auth is enabled on the Catalyst project. Public
self-signup is currently **off** — only users added via Catalyst's Add User
(sends an invite email) can sign in. Flip it on in the console under
Authentication → Embedded Authentication → Public Sign-Up when ready for
arbitrary users to self-register. Before making further auth changes,
double-check the registered sign-in redirect domain exactly matches the
project's real domain
(`https://training-tracker-20117369913.development.catalystserverless.eu`,
no trailing slash), and test through `catalyst serve` — never a bare
`vite dev` server — per the auth note above.

## Data Store

Tables so far: `TrainingPlan`, `PlanWorkout`, `PlanExercise`, `PlanSet`,
`Exercise`, `ExerciseAlias`, `WorkoutSession`, `UserPreferences`. Relations
between tables are stored as plain ROWID-reference columns (e.g.
`WorkoutSession.plan_id`, `PlanExercise.exercise_id`), not native Catalyst
foreign-key columns, and are enforced at the `functions/api` layer rather
than by the database — this keeps delete/soft-delete behavior (plans must
never destroy historical sessions) predictable and explicit. The remaining
tables (`SessionExercise`, `SessionSet`, `BodyMeasurement`) are added in
later phases as their features are built.

**Every new table needs its permissions widened before it's usable.**
Catalyst creates tables with the `App User` role defaulting to `SELECT`
only — any insert/update/delete from a real logged-in (non-admin) user 401s
with `NO_ACCESS` until `Update_Table_Permissions` grants `App User` full
CRUD too. This is a separate, coarser gate from `functions/api`'s own
per-user ownership checks; both need to be right. Hit this in Phase 3 when
plan creation failed silently in the UI — check `Get_Logs` for `NO_ACCESS`
first if a new write endpoint doesn't work.

### Plans

A plan is a template: `TrainingPlan` → ordered `PlanWorkout`s → ordered
`PlanExercise`s (referencing the shared `Exercise` library, never copying
it) → ordered `PlanSet`s. `functions/api/src/routes/plans.js` verifies the
whole ownership chain per request (a plan belongs to the caller; a workout
belongs to that plan; an exercise belongs to that workout; a set belongs to
that exercise) via Express `router.param()` handlers, so no nested route can
be reached by forging an ID that happens to belong to someone else's plan.

Only one plan can be `active` per user — `POST /plans/:id/activate`
deactivates (back to `draft`) any other plan the same user has active in the
same request, so the invariant can't be violated by two racing requests
landing on different code paths. Status changes only ever happen through
`activate`/`archive`/`complete`, never through the general `PATCH /plans/:id`,
for the same reason. `POST /plans/:id/duplicate` deep-copies the whole
workout/exercise/set tree as a new draft plan; reordering (`workouts/reorder`,
`.../exercises/reorder`) takes a full ordered list of IDs and rejects
anything that isn't exactly the current set, rather than trying to
interpret a partial reorder. There's no plan `DELETE` endpoint in v1 —
`archive` is the only removal path, since a plan may be referenced by
historical sessions once Phase 4 exists.

### Exercise library

`Exercise` rows are either system-owned (`owner_user_id` null, visible to
everyone) or user-owned (`owner_user_id` set, visible only to that user) —
never both. A curated seed of 99 common strength exercises across all major
muscle groups and equipment types lives in
[`functions/api/seed/exercises.json`](./functions/api/seed/exercises.json)
and has been loaded into the Development environment; `ExerciseAlias` rows
support alternate names for later JSON-import matching (Phase 6). Custom
exercises are created via `POST /exercises`, checked against a normalized
name for obvious duplicates (name is lowercased, punctuation stripped, and
compared against everything the caller can already see), and can only be
edited/soft-deleted (`is_active = false`) by the user who owns them — never
system exercises, never another user's.

## Known limitations

- Workout logging and history are not built yet (Phases 4-5).
- The exercise search endpoint fetches all visible rows and filters in
  memory rather than querying — fine at the curated library's current scale
  (~100 rows) but would need revisiting if the library grows much larger.
- The PWA service worker registration hasn't been verified in a real mobile
  browser yet (only checked in an automated browser pane, which may restrict
  Service Worker APIs regardless of app correctness).
- Offline resilience for active workouts (Phase 7) is not built.
