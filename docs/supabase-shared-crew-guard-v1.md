# CAD shared-crew database guard (2026-10-13)

Migration `cad_shared_crews_assignment_guard_v1` applied successfully to the dedicated `sonomarzi-cad` Supabase project.

## New database tables
- `cad_shared_crews`: agency-scoped crew name.
- `cad_shared_crew_units`: links a unit to at most one shared crew, with composite agency foreign keys.
- Both tables have RLS enabled, agency-member SELECT policies, and no direct client write policies.

## Assignment enforcement
`cad_assign_unit` now acquires an agency-scoped PostgreSQL transaction advisory lock before row locks, then checks:
- Authenticated agency write permission.
- Expected incident and unit versions.
- Incident not closed and unit AVAILABLE.
- No existing active assignment for the unit.
- No active assignment for another unit in the same shared crew.

On success, it inserts the assignment, updates unit and incident versions/status, and appends an event in the same transaction.

## Verified
- Migration succeeded.
- Both new tables exist and are empty.
- Both read policies exist.
- CAD incident and assignment tables remain empty.

## Limitations / next tests
- No agency/auth users or shared crews have been provisioned; live positive-path tests are outstanding.
- No two-connection concurrency test has been performed.
- The shared-crew model currently allows a unit in only one crew. Crew membership editing requires authenticated admin RPCs.
- Agency-wide assignment serialization trades some throughput for simpler correctness. Benchmark under realistic dispatch loads.
- Batch response-plan assignment RPC is still required. Browser-side plan batch checks are not a server transaction.
- Need to test cross-agency access, stale versions, append-only history and event closure using authenticated test accounts.
- No frontend connection or production cutover yet. No legacy PS Suite data deleted.
