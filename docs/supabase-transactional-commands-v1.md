# Supabase CAD transactional commands v1

Applied 2026-10-13 to Supabase project `sonomarzi-cad` (`gtmdigvuwjyfpgpdjmph`), migration `cad_transactional_commands_v1`.

## Installed SECURITY DEFINER RPCs
All RPCs check `auth.uid()` and `cad_has_access(agency_id,true)`, have an empty function search path, and are granted to `authenticated` (not `anon`).

- `cad_create_incident(agency,number,discipline,type,priority,location)`: creates incident, PRIMARY location and event record.
- `cad_assign_unit(agency,incident,unit,expected_incident_version,expected_unit_version)`: locks incident and unit, checks versions and availability, creates assignment and audit event. Partial unique index on active unit assignments enforces one active incident per unit.
- `cad_change_unit_status(agency,incident,unit,status,expected_unit_version)`: requires active assignment, checks version and logs transition.
- `cad_correct_location(agency,incident,location,expected_version,source)`: adds PREVIOUS and PRIMARY records; immutable historical records are never rewritten; updates current address and logs correction.
- `cad_close_incident(agency,incident,disposition,expected_version)`: validates disposition, releases assigned units, closes incident and logs disposition.

## Verification completed
- Migration returned success.
- PostgreSQL catalog confirmed all five functions are SECURITY DEFINER and have execute grants for authenticated, postgres and service_role, not anon.
- An anonymous-role attempt to invoke `cad_assign_unit` was rejected with permission denied.

## Outstanding before connecting frontend
- Provision test auth users and agency memberships; perform cross-agency denial tests.
- Execute two-session race tests for competing unit assignment and conflicting versions.
- Test transaction rollback on invalid operations, append-only location history, and all RPC error paths.
- Review incident numbering (currently caller-provided), authorization granularity (VIEWER denied writes), shared-crew enforcement (not yet server-side), unit lifecycle and temporary mutual-aid workflows.
- Review locking behavior and indexes under load; consider a lock-order policy and deadlock retries for concurrent close/assign operations.
- Do not use service-role credentials in frontend. Add opt-in authenticated Supabase adapter only after validation.
- Existing legacy PS Suite tables remain intact. Main branch and AWS product untouched.

This is a CAD concept backend, not a certified production emergency dispatch system.
