# CAD migration: response plans and unit clearing

Applied to Supabase project `sonomarzi-cad`, migration `cad_response_plan_and_unit_clear_v1`.

## New server-side operations

### `cad_assign_response_plan`
Inputs: agency UUID, incident UUID, unit UUID array (1–30 unique), expected incident version, JSON object of unit UUID -> expected version.

- Requires authenticated write membership in the agency.
- Uses the same agency advisory transaction lock as individual unit assignment.
- Locks incident and units, checks all expected versions and unit availability.
- Rejects shared crew conflicts within the plan and with already-committed units.
- Creates all assignments, sets units DISPATCHED, activates incident, and appends one event per assigned unit in one database transaction.
- Any error aborts the entire operation. No partial dispatch commits.

### `cad_clear_unit`
Inputs: agency UUID, incident UUID, unit UUID, expected incident/unit versions, optional disposition.

- Requires authenticated write membership.
- Locks agency, incident and unit.
- Marks the assignment cleared, returns unit to AVAILABLE, records disposition in an append-only event.
- If no active units remain, incident becomes PENDING (not automatically CLOSED). Explicit `cad_close_incident` requires an event disposition.

## Current state
- Migration returned success.
- No frontend wiring yet. Existing browser demo continues using its local synchronous commands.
- No authenticated multi-user or concurrency tests have been run.
- Provisioning, response-plan definitions, shared-crew configuration, cross-agency mutual aid, and permanent unit-status event history remain to be completed.
- Main branch and SonoMarzi AWS production app untouched. Existing legacy PS Suite tables untouched.
