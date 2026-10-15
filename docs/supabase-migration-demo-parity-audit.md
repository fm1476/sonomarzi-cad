# CAD Supabase migration — demo parity audit (2026-10-14)

Scope: `fm1476/sonomarzi-cad`, shared Supabase demo workspace vs prior browser-local CAD. This is a **prototype** and not a production CAD certification. Tests are not substitutes for a live two-client browser smoke test.

## Evidence and verdicts

| Workflow | Current disposition | Evidence / caveat |
|---|---|---|
| Shared incident list, assigned/pending boards, roster sync | Implemented | Supabase polling + projection; must confirm two browsers |
| Spoken unit ID, phonetic alphabet, ASR variations | Code/tests implemented | Requires real mic tests; no guarantee browser transcription |
| Shared dispatch of one unit to existing matching-discipline call | Wired and post-refresh verified | Supabase `cad_assign_unit`; test fresh and busy unit |
| Shared ENROUTE / ONSCENE / CODE4 / CLEAR | Wired with post-refresh checks | `cad_change_unit_status` now permits CODE4; test each live |
| PREEMPT from one call to another | Atomic transaction installed | Both incident events recorded; test same agency and conflict |
| Working-fire reclassification | RPC installed | Original type retained in incident-event audit; reporter must be assigned |
| Dispatcher edit of CFS, priority, location, case number | Restored | `cad_edit_incident` atomic update; verifies refreshed shared fields |
| Call-taker edit of CFS, priority, location, case number | Restored for supported fields | Extended fields are explicitly declined rather than falsely marked saved |
| Call-taker add narrative | Authenticated RPC | Test through browser |
| New basic call | Authenticated RPC | **GAP:** caller, phone, initial narrative and case number not stored from new form. Warning added |
| Call-taker caller details, reporting parties, people, vehicles, custom event fields | **NOT PARITY** | Not present in shared incident schema; local-only edits cannot persist |
| Caller/phone fields in dispatcher editor | **NOT PARITY** | Shared editor intentionally limited to persisted fields |
| Manual activation of pending event | Implemented, awaiting browser verification | Authenticated `cad_activate_incident` RPC installed |
| Save & Clear from call-taking editor | Implemented, awaiting browser verification | Uses authenticated `cad_close_incident` via shared gateway |
| Voice-created traffic stops, subject contacts, follow-ups | **NOT PARITY** | Shared mode recognizes or reviews, does not commit atomic self-init creation + assignment |
| Multiple-unit and linked cross-discipline voice dispatch | **PARTIAL** | Shared voice guard intentionally limits simple dispatch to one same-discipline unit |
| Map voice commands (layers, zoom, location, units/calls filters) | Restored routing, browser verification pending | Map commands bypass shared CAD mutation guard; layers retain map viewport; localhost microphone uses Web Speech API where supported |\n| Plan dispatch, custom incident forms, specialty statuses, response shortfalls, station edits | **NEEDS EXPLICIT LIVE PARITY TEST** | Local logic exists; each mutation needs matching shared RPC or clear read-only treatment |
| Existing local CAD demo | Available | Sign out of Shared CAD; local browser state returns. **Not shared across dispatchers.** |

## Demo-safe manual verification (two signed-in browsers, fictional records only)

1. Confirm current branch, run `npm test`, start local HTTP server on 8001 and hard-refresh.
2. Two browsers: same agency/tenant. Create a basic event in one; verify appears in other after refresh.
3. Dispatch an AVAILABLE unit; confirm assigned list + DISPATCHED roster in **both** browsers.
4. Test ENROUTE, ONSCENE, CODE4 and CLEAR; each must update board and incident history.
5. Re-dispatch, then PREEMPT to a second incident; verify old removed, new assigned, status DISPATCHED.
6. Dispatch E1 to a Fire Alarm; say confirmed working structure fire; verify reclassified Structure Fire and historical event.
7. Dispatcher edit: location, type, priority, case number; confirm after refresh and in second browser.
8. Call-taking editor: change location or priority, save, verify after refresh. Add narrative; verify history.
9. Test map voice commands: show/hide hydrants and GIS layers, clear layers without changing zoom, go to address, show P1 calls, and find a unit. Test both radio PTT and Ask the Map on localhost.\n10. Test ambiguous commands and unavailable units: must show REVIEW, **never** false success.
11. To demonstrate caller details or extended parties/vehicles **without shared functionality**, log out of shared CAD and use the original local demo. Do not describe that mode as multi-dispatcher.

## Shipping gate

**DO NOT claim complete parity** until all gaps above are implemented and tested. GitHub checks validate JavaScript regression tests, but do not execute live authenticated Supabase transactions in a real browser. Current branch is a development/test PR, not main. Keep a clear fallback to local demo.

