# CAD response-plan staffing data contract (design, not a deployed migration)

Read-only schema inspection of the actual CAD Supabase project confirmed:
- `cad_units` includes unit ID, agency, callsign, discipline, status, station, and resource type, but **no personnel IDs or verified staffing count**.
- `cad_shared_crews` defines crew ID/agency/name.
- `cad_shared_crew_units` connects crew IDs to units. It does **not** identify the people assigned to the shared crew.
- No personnel staffing inference may be made from unit status AVAILABLE, unit type, or shared crew relationships.

## Required verified data before enforcing minimum crew in shared dispatch
A tenant-scoped assignment source must map `agency_id`, `unit_id`, `person_id`, sign-on and sign-off timestamps, and verification context. The source must support overlapping assignment conflict prevention, agency authorization, version checks, and an audit trail. If an authoritative personnel directory is created, unit staffing must reference person IDs, not free-form names.

Read-only roster enrichment should only produce `unit.staffing={active:true,personIds:[...]}` when assignments are confirmed current, unique, agency-scoped and verified. Otherwise staffing must remain absent/unknown, and any plan with `requiredStaffing` must show **Staffing not verified**, not select the unit.

No schema or live data changes are included here. PR #33 must remain draft until an independent database test environment is operational and authenticated end-to-end staffing checks pass.
