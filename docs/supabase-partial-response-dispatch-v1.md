# Partial response-plan dispatch

Applied Supabase migration `cad_partial_response_plan_dispatch_v1`.

The server-side `cad_assign_response_plan` now dispatches eligible units and returns `assigned_unit_ids`, `unfilled` entries (`unit_id`, `reason`), `incomplete`, and the incident version. Each operation is serialized at agency scope and appends a `RESPONSE_PLAN_EVALUATED` event.

Candidate-specific failures (unavailable, committed, shared crew busy, unknown unit, missing/stale unit version) do not block other candidates. Fatal request errors (unauthorized, closed/missing incident, stale incident version, malformed plan) reject the entire operation.

**Still to implement:** resource requirements by apparatus capability/count (e.g. three engines, one truck, one ambulance), intelligent substitutions, durable unresolved shortfall state, dispatcher warning UI, and re-evaluation when additional units arrive. The current response indicates unavailable *specific unit IDs*, not missing resource categories. The current frontend is still local-only. Authenticated and concurrency tests have not yet run.

No main branch or AWS SonoMarzi product changes.
