# CAD pre-Supabase refactor audit — initial baseline

## Current architecture observed on develop
- `app.js` (~62 KB) owns demo state, rendering, incident edits, unit changes and persistence. It exposes `cadSafetyState` and `cadCallTakeSave` globals.
- `call-taking-workspace.js` (~27 KB) mutates shared incident objects and invokes global save functions.
- `alarm-levels.js` (~17 KB) stores configuration in `smcad-alarm-levels-v1`; response plans use `smcad-response-plans-v1`.
- `index.html` contains significant inline voice-command orchestration.
- Browser storage remains spread across modules; `core/persistence.js` now wraps the primary incident-state read/write only.

## Critical architectural requirements
1. Centralized command service for incident, unit, alarm and response actions, shared by voice and manual controls.
2. Authoritative database transactions for incident creation, case number allocation, assignments and unit status changes.
3. Append-only incident event and location records. Preserve old PRIMARY, CALLER, RELATED and REPORTED_IN_ERROR locations and classification changes. Never replace a location history with only the latest address.
4. Versioned writes with optimistic concurrency and clear user-facing conflicts; do not silently overwrite another dispatcher's edits.
5. Authenticated multiagency access, server-enforced permissions, RLS, and separate CAD Supabase project scope.
6. Realtime subscriptions with resync after reconnect; events are notifications, not authoritative writes.
7. Separate GIS/reference data from authoritative dispatch data; layer toggles must preserve map viewport.
8. A deterministic local demo mode remains available while Supabase integration is developed.

## Migration sequence
- Phase 1: baseline tests and inventory of all browser-storage keys, global mutators, and event consumers.
- Phase 2: extract domain commands and local adapter; keep existing UI behavior and data shape.
- Phase 3: create CAD schema, security policies, append-only event tables and RPCs in repurposed Supabase project.
- Phase 4: introduce opt-in Supabase adapter; migrate modules one at a time and compare against local mode.
- Phase 5: test concurrent dispatchers, offline/reconnect, audit, and role isolation before switching defaults.

## Validation gates
- `npm run check` and manual Dispatch, Call Taking, map, alarm-level and voice smoke tests.
- Two-browser simultaneous edits and unit-assignment conflict tests.
- Confirm old location records remain queryable after every primary-location correction.
- No merge to `main` or production deployment until validation.

## Known limitations
This is an initial source audit, not a full line-by-line review. No browser automation or end-to-end test has yet validated the refactor. The local adapter is intentionally synchronous; remote persistence must not be substituted directly into synchronous render/save code.
