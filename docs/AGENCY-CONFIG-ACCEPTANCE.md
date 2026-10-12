# Agency Configuration 1.0: Local Acceptance Test

Use a **local checkout of develop**. Do not test against the production Netlify demo. Agency master configuration is browser-local and does not sync across computers.

## Before testing
1. Back up any valuable agency configuration using **Configuration > Agencies & Units > Export Agency Master JSON**.
2. Open the CAD application locally and select **Configuration > Agencies & Units**.
3. Keep an existing dispatch tab open to verify no operational records are overwritten.

## Scenario A: Mixed identification models
1. Create agency `TESTSO`, name `Test Sheriff`, default `HYBRID`.
2. Create agency `TESTFD`, name `Test Fire`, default `APPARATUS`.
3. Create personnel `1476` and `1477` under `TESTSO`; create `900` under `TESTFD`.
4. Create unit `so-1476`, radio `1476`, agency `TESTSO`, discipline `LAW`, model `PERSONNEL`.
5. Create unit `so-3a12`, radio `3A12-TEST`, agency `TESTSO`, discipline `LAW`, model `FIXED`.
6. Create unit `fd-e99`, radio `E99-TEST`, agency `TESTFD`, discipline `FIRE`, model `APPARATUS`.
7. Confirm all three appear as definitions with the correct agency and discipline.

## Scenario B: Activation and staffing
1. Select **Activate in CAD** on `1476` and `E99-TEST`.
2. Verify each appears on the operational unit roster with the correct discipline and owning agency.
3. Activate `1476` a second time. It must reject the duplicate.
4. Select `1476` in Duty Sign-on, choose personnel `1476`, and sign on.
5. Sign on personnel `900` to `E99-TEST`.
6. Verify current crew is shown for each unit.
7. Try assigning a member of the Sheriff's Office to a Fire unit via import or direct model test. The system must reject cross-agency staffing.
8. Sign off an available, unassigned unit. It should succeed.
9. Dispatch a staffed unit to an active incident, then attempt sign-off. It must reject the operation until the unit is no longer committed.

## Scenario C: Persistence and reset
1. Export the agency master JSON.
2. Reload the browser. Verify agencies, personnel, and unit definitions persist.
3. Use **Reset Entire Demo**. Verify operational units return to sample defaults.
4. Reopen **Agencies & Units**. Verify your configured agencies, personnel, and unit definitions still exist.
5. Import the exported JSON. Verify records are restored correctly.

## Scenario D: Regression
1. Confirm LAW/FIRE/EMS unit board filtering works for activated units.
2. Confirm map filtering follows the selected discipline.
3. Confirm existing incident creation, dispatch, unit status changes and voice recognition still function.
4. Confirm the Configuration selector can navigate back to Calls for Service and Voice Phrases.

## Current limits
- Master records and staffing are stored in the browser, not in a shared database.
- Activated operational units are part of the resettable demo roster; definitions survive reset.
- Unit activation does not automatically staff or sign on a person.
- This is a proof of concept. Do not use for live dispatch.
