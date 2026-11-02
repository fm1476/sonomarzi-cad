# Shared-crew assignment override, design contract

**Draft PR #33. Not deployed. No existing CAD assignment RPC accepts an override.**

## Dispatcher flow
1. Dispatcher selects an apparatus whose shared crew is committed by another apparatus.
2. CAD shows the conflicting unit(s), current incident(s), and a warning that personnel availability is **not** verified by this override.
3. Only a role with explicitly assigned `shared_crew_override` permission may proceed. A second confirmation and meaningful reason (10–500 characters) are required.
4. The server rechecks the selected unit, incident, expected versions, current crew relationships, agency and authority *at transaction time*. A client-side authorization flag is never trusted.
5. If still eligible, the server commits the assignment, increments versions, records the reason and conflict details as an append-only incident event, and returns its authoritative result. A rejected or stale operation leaves the incident and units unchanged.

## Server requirements before enabling
- New isolated, auditable RPC (for example `cad_assign_unit_with_shared_crew_override`), not a client change to existing `cad_assign_unit`.
- The agency-configured role permission must be server-authoritative, not user-editable JWT metadata.
- Reuse the assignment advisory transaction lock key 72361 and deterministic row locking.
- Recheck all ordinary guards (agency, incident active, target unit status, target already committed, versions, applicable holds). **Only** the shared-crew sibling rule may be overridden.
- Record actor ID, agency, incident, target unit, every conflicting sibling unit and incident, reason, timestamps, expected versions, and final result in CAD incident events.
- Explicit audit requirements and permission revocation tests, including cross-agency attempts, expired/stale sessions, simultaneous dispatch, preempt, crew-edit races and multiple conflicting siblings.
- Existing functions stay unchanged, retaining default deny. No frontend call until a tested RPC and migration are deployed and the user authorizes that change.

## Prototype preflight
`CadSharedCrewConfig.overrideReview` checks locally for a shared-crew conflict, explicit authorization input, and reason length. It returns `REQUIRES_SERVER_CONFIRMATION` rather than assigning a unit. It is advisory UI validation only, never proof of authorization or an override.
