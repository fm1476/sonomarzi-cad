# CAD Supabase foundation — migration v1

Applied to Supabase project `sonomarzi-cad` (`gtmdigvuwjyfpgpdjmph`) on 2026-10-13 using migration `cad_foundation_v1`.

## Created
- `cad_agencies`, `cad_memberships` (authenticated agency membership with ADMIN, SUPERVISOR, DISPATCHER, VIEWER roles).
- `cad_stations` (station name, address, coordinates).
- `cad_incidents` (agency-scoped number, discipline, type, priority, status, current location, version).
- `cad_units` (agency-scoped call sign, discipline, status, station, temporary/mutual-aid metadata, version).
- `cad_assignments` (one active incident per unit, enforced by a partial unique index).
- `cad_incident_locations` (append-only, classification/source/verification).
- `cad_incident_events` (append-only event history and actor).
- RLS read policies for authenticated agency members. No client insert/update/delete policies; transactional RPCs are required for writes.

## Current limitations / work required
1. No browser Supabase client or authentication integration. Local demo remains unchanged.
2. No RPCs yet for agency provisioning, incident creation, atomic unit assignment/status, incident closure, location correction, or optimistic version checking.
3. No tenant memberships have been provisioned. Tables are intentionally empty.
4. RLS policy and RPC security need multi-user/agency penetration and permission tests before operational use.
5. Location records are immutable; corrections will be new append-only entries rather than mutating PRIMARY into PREVIOUS.
6. The schema is an initial foundation, not production dispatch readiness. Shared crews, cross-agency mutual aid, response plans, call-taking details, and unit history need additional modeling.
7. The unique active assignment constraint intentionally disallows one unit on multiple simultaneous incidents. Revisit with explicit operational policy before enabling shared assignments.
8. Existing legacy PS Suite tables remain intact and have not been deleted.

## Next migration
Build authenticated security-definer RPCs with explicit `auth.uid()` authorization, row locking, expected-version checks, and append-only audit records. Run two-session concurrency tests and agency-isolation checks before wiring up UI writes.
