# CAD persistent response requirements

Applied Supabase migrations `cad_persistent_resource_shortfalls_v1` and `cad_automatic_shortfall_sync_v1`.

## Database model
- `cad_units.resource_type` classifies apparatus/capability. Existing units default to their discipline (LAW/FIRE/EMS) until specifically configured.
- `cad_response_requirements` records required and fulfilled counts per incident and resource type.
- `cad_outstanding_resources` is an agency-RLS-protected security-invoker view of remaining resource shortages.

## RPCs
- `cad_set_response_requirements(agency,incident,expected_version,requirements)` accepts a JSON array such as `[{"resource_type":"ENGINE","count":3},{"resource_type":"AMBULANCE","count":1}]`. Requires authorized write access, validates resource counts, recalculates existing assignments and appends a requirements-set audit event.
- `cad_refresh_response_shortfalls(agency,incident)` recalculates and returns the outstanding resource categories/counts.

## Automatic synchronization
Assignment insert/clear/delete triggers recalculate fulfilled counts whenever incident assignments change. This includes dispatching a partial plan, clearing a unit, and closing an event.

## Still outstanding
- Configure specific resource types on each unit; current values are discipline defaults.
- Build response-plan templates and agency-specific resource substitution logic.
- Connect UI to Supabase; show persistent shortage badges and allow filling gaps with mutual aid.
- Multi-user, race, authorization and trigger tests have not yet run.
- Existing local demo remains unchanged; no main/AWS changes.
