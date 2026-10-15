# CAD Voice Recognition and Supabase Parity Audit

Scope: standalone CAD proof of concept only; never the SonoMarzi commercial SaaS. Reviewed prior radio/voice decisions, the local voice handler, the shared Supabase gateway, and current regression tests.

## Implemented in shared CAD (develop, not main)

- Browser PTT audio recording, Netlify transcription and Chrome fallback; diagnostics for missing audio and provider failures. Actual live-microphone testing remains necessary.
- Callsign recognition with phonetics, ASR "out of" substitutions, leading compressed numerics, and Adam-as-zero cases; only unique roster matches are actionable.
- Existing unit logging on/off and returning to service via authenticated roster RPC, without needing an incident.
- Unregistered Rescue/Engine/Medic/Truck/Battalion callsign logging on: explicit operator confirmation, temporary unit registration in shared roster; no silent creation.
- Existing assigned unit enroute, on-scene, transporting, at-hospital and out-of-service via version-checked status RPC.
- Clear unit with a dispatcher-provided or explicitly spoken disposition; incident closure is distinct.
- Spoken dispatch by unit and unique incident type/address, using shared transactional assignment RPC; ambiguous matches do not dispatch.
- Spoken case-number request for a uniquely assigned incident, with atomic database allocation and history event. No browser-invented case numbers.
- Spoken narrative additions and confirmed incident-location corrections through authenticated RPC.
- Explicit new incident creation with a configured call type and address through authenticated shared RPC (default priority P2; do not infer unspoken urgency).
- Agency/tenant authorization checks and optimistic version checks on roster, status, and case-number RPCs.
- Mocked integration regression coverage for the shared voice paths, plus pre-existing legacy voice tests.

## Existing functionality that is NOT yet at full shared-mode parity

- Agency phrase editor is currently a browser-local, non-executing preview, not a synchronized Supabase agency-wide voice dictionary.
- The separate read-only Ask CAD/map voice path remains distinct; shared radio PTT does not comprehensively route every map layer, map query, or map location request.
- Legacy field self-initiated traffic-stop and advanced incident creation variants, multi-unit compound transmissions, linked Fire/EMS incident creation, classification changes, and voice preemption have not been fully migrated into shared transactional workflows.
- Advanced unit statuses CODE4 and AVAILABLE_ON_SCENE are not accepted by the shared status RPC; do not remap them to an inaccurate status.
- Voice priority/agency/discipline/caller changes and all advanced dispatch editing flows require shared-mode work.
- Voice summaries, complete incident-linked transcripts, agency vocabulary administration and comprehensive radio-audit history remain incomplete in shared mode.
- Temporary units currently register with a generic shared location; station-cover assignments, precise coordinates, and detailed mutual-aid roster metadata require separate workflows.
- Full live browser, multi-dispatcher, Netlify/OpenAI transcription and microphone regression tests have NOT been performed; GitHub Actions checks are not substitutes.

## Safety and rollout

Changes are on develop. Do not merge to main or deploy production until a real dispatcher-session acceptance test verifies each supported action, cross-session sync, and no unintended writes. Existing Supabase migration adds three authenticated RPCs and a case-number sequence; no demo units were inserted during migration.

## Suggested acceptance utterances

1. "Logging on Rescue One" -> prompt to register temporary R1; confirm -> R1 AVAILABLE.
2. "Rescue One logging off" -> R1 OFF_DUTY if no active assignment.
3. "Three Adam Fourteen respond traffic collision 123 Main Street" -> dispatch only to unique matching open call.
4. "Three Adam Fourteen show me enroute" -> ENROUTE on existing assignment.
5. "Three Adam Fourteen on scene" -> ONSCENE.
6. "Three Adam Fourteen requesting a case number" -> allocate or return existing case number.
7. "Three Adam Fourteen add note patient is conscious" -> add incident narrative.
8. "Three Adam Fourteen update location to 456 Main Street" -> explicit confirmation and correction.
9. "Create incident traffic collision at 123 Main Street" -> new P2 incident.
10. "Three Adam Fourteen clear with disposition report taken" -> clear unit, not close entire incident.
11. Ambiguous or negated phrases -> no shared write.
