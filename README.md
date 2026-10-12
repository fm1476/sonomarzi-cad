# v19.4 — Map Query Isolation

Each map question now replaces the prior map view with only matching unit and incident markers. New supported combination: “show me all pending calls and available units”. Queries include P1/P2/P3 calls, unit lookup, assigned units, available units, and pending/active calls. A Reset View button restores regular map display; changing the call filter also resets query isolation. Query filtering survives routine CAD redraws without changing CAD records. Positions are simulated and call locations require geocoding.

Validation: JavaScript syntax and existing Node regression scripts. Interactive browser/microphone checks remain necessary.

# v19.2 — Compound Radio Reclassification Fix

Recognizes multi-action transmissions where a unit reports a confirmed working fire, requests resources, says "Break," and names resources before saying "respond." The scene report is processed first, then additional-unit dispatch. The reporting unit is excluded from the second clause. Includes exact-phrase regression coverage, plus the preexisting test suite.

Validation: code-level tests; live microphone and browser workflow not yet verified.

## v18.9 Traffic Stop Punctuation Fix
Recognizes transmissions such as `3Adam14, traffic stop, 1562 Henry Way` (comma or radio punctuation between callsign and action). Captures vehicle and phonetic plate and updates the known available unit to ON SCENE. Includes exact-transcript regression coverage. No changes to stored event data or configurations.

# CAD Voice Intelligence v18 — Multidisciplinary Linked Incidents

## What changed
- LAW, FIRE and EMS are independent incident disciplines. When a unit is assigned to an incident belonging to another discipline, CAD creates a discipline-specific linked event, copying the source location, caller, telephone, priority, and up to eight initial narrative lines. Original record is not overwritten.
- Repeated assignments of the same discipline within the same incident family reuse the open linked event instead of generating duplicates.
- Independent unit assignments, events, incident state, case numbers and closures. Link details are shown on the incident board and incident detail pane.
- Applied to manual dispatch, typed D/DE/PRE commands, drag dispatch and voice dispatch.
- Dispatch conflict checks remain; automatic cross-discipline linking does not authorize moving a busy unit without preemption.

## Testing
- JavaScript syntax validation for all app and Netlify Function files.
- Automated regression assertions for linked creation, same-discipline reuse, linked-child-to-root matching, root assignment preservation, and link metadata.
- Full interactive Chrome acceptance testing is still necessary, especially voice recognition and multi-monitor views.

## Deploy
Extract ZIP and **cd into the folder containing index.html**, then run:

```bash
npx netlify-cli link
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

Browser demo data is retained. Do not reset demo data. This remains a browser-local prototype; no shared dispatcher database or cross-browser incident synchronization is guaranteed.

---

# CAD Voice Intelligence v17.0 — Workspace Cleanup

Built on v16.9. The command bar now only shows a drag handle, command input, and Execute. Old placement/reset/find controls remain hidden for compatibility with earlier scripts. Individual pane Pop Out buttons are removed. For a separate physical monitor, use Workspace Layout → Other monitor → Open Window. Freeform panes still move/resize independently and named workspace saves still work. No changes to dispatch transactions, voice processing, or CAD data.

# CAD Voice Intelligence v16.9 — Freeform Workspaces

This build replaces the restrictive three-column workspace with freely draggable and resizable panes. Grab a pane heading to reposition it on the CAD canvas, and the lower-right corner to resize height and width independently. The Workspace Layout toolbar itself is movable and resizable.

Use Save New to name a layout, or Update to save your latest positions in an existing layout. Load switches layouts. Reset Layout resets UI preferences, not operational incident data. Fit Canvas recovers panels displaced beyond the visible width. Pop-out windows remain available. The layout is persisted in localStorage on this browser; monitor positions cannot be physically restored across machines.

Operational CAD records, transcript processing, OpenAI Netlify functions, and incident actions were not intentionally changed. This is a POC layout and has passed syntax and archive checks, but requires live Chrome testing (including pop-outs and the map).

## Deploy

From the extracted project folder, run `npx netlify-cli link` and select `cad-voice-intelligence`, followed by `npx netlify-cli deploy --prod --dir=. --functions=netlify/functions`.

# CAD Voice Intelligence v16.5 — Saved Workspaces

Adds named workspaces with Save New, Update, Load, Rename, Delete and Reset Layout; stores board sort/filter options, header column order, panel positions, board heights and command-line placement/width in browser localStorage. Switching presets reloads the page to apply saved board controls consistently. It DOES NOT synchronize workspaces across devices; export via existing demo mechanism does not include saved workspace presets. Also adds a bottom-edge height handle to Pending Calls, Active Incidents and Units, and right-edge horizontal width grip to the floating command bar. Operational CAD data is unchanged.

# CAD Voice Intelligence v16.3 — Command Line Layout Repair

Fixes the command field moving out of sight while its results remain visible. The command line now defaults to top placement for new profiles, can be docked at three positions or set to Floating / draggable, and supports resize in floating mode. Drag by the COMMAND header; resize from the lower right. `Find Command Line` in Command Results moves it back to the top and focuses the field; `Reset position` does the same. Placement and floating geometry are saved in browser localStorage. Existing dispatch, transcription, voice, map and board functionality is preserved.

Syntax/ZIP validation is not a substitute for browser acceptance testing. For deployment, link this extracted folder to the existing Netlify project and deploy the directory and `netlify/functions`. Do not reset demo data.

# SonoMarzi CAD Voice Intelligence v10 | Netlify Hackathon Edition

Preserves CAD v9 including push-to-talk, unit identification, status engine, radio transcripts, and the local rules-based narrative fallback.

## Deploy

1. Add these files to the **existing Netlify site**, including `netlify/functions/summarize.js` and `netlify.toml`.
2. Under Netlify site settings, set secret environment variable `OPENAI_API_KEY` (server-side only). Optionally `OPENAI_MODEL=gpt-4.1-mini`. Do not paste an API key into browser JavaScript.
3. Deploy the **folder with Netlify CLI or Git**, not a basic drag-and-drop static deploy, because Netlify Functions need to be built/deployed. Suggested terminal workflow: `npx netlify-cli deploy --prod --dir=. --functions=netlify/functions` once linked and authenticated, or connect a repo and push this version.
4. Test a radio transmission. Status updates remain local. AI summaries asynchronously replace the local fallback after success. If the AI is unreachable, the local summary remains in place.

## Important

No live Netlify deployment or API secret configuration was performed by the assistant. Browser `localhost:8080` does not run Netlify Functions. For local AI tests, use `npx netlify-cli dev` with the Netlify environment set. Demo only, not operational dispatch.


## v10.1 incident linkage hotfix
Unrecognized callsigns still log the full transmission to the selected active event. Unit status remains unchanged unless the unit is unambiguously resolved. CAD Interpretation shows `v10.1` to confirm the updated code loaded.


## v11 Hackathon Dispatch Operations
Select an incident and unit in Dispatch Operations. Dispatch a unit, change its status, release it, and give the call a case number. Use Call Taking to create additional incidents and assign any available unit. Manual dispatch/status transactions appear in Event History. The existing radio-to-CAD and Netlify OpenAI summarization remain installed. Data persists per browser via localStorage.

To deploy to the existing Netlify project, from this folder run `npx netlify-cli link` if needed, then `npx netlify-cli deploy --prod --dir=. --functions=netlify/functions`. Do not upload keys in files. This is not for live public safety use.

Use Add Demo Unit to create additional unit identifiers in the local browser, then dispatch them through the control desk.

### Hackathon status workflow
Dispatch Operations includes Dispatched, Enroute, On Scene, Code 4, Available on Scene, Clear, and Clear with Disposition (plus general Available, Out of Service, and Transporting). Code 4 and Available on Scene keep the unit assigned to the incident. Clear releases the unit and retains CLEAR as its displayed status; it can be dispatched again. Clear with Disposition requires a disposition and writes it to the incident event history. The incident remains open until explicitly closed. Voice supports Code 4, Available on Scene, and Clear where unambiguous. Voice requests to clear with disposition are review-only to avoid inventing a disposition.

## v11.2 Six preloaded patrol units
Six Petaluma Police patrol units: 3A12, 3A14, 3A16, 3A18, 3A21, and 3A22. 3A21 begins On Scene on incident 26-004518, the other five begin Available. Existing browser records are preserved; missing new units are seeded once when the new version loads. Sonoma County Sheriff unit SO12 and Fire/EMS units remain available. Reset Demo restores these six units.


## v11.3 radio/event workflow
The push-to-talk button is in the top-center header. Select a call with the new Radio Event selector or click an incident in the CAD call list. The selector follows incident selection, so multiple open events can be worked in succession. Create new events in Call Taking, activate/assign in the control desk, and select the target event before transmitting. Recognized unit IDs are correlated with their assigned incident; radio traffic lacking a reliable unit match is still recorded to the selected incident, but cannot change unit status.

The existing Netlify AI summarization function and environment variable setup are unchanged.


## v11.4: Reset Entire Demo
The reset control is at the very bottom of the page, away from dispatch and radio operations. It is optional and intended for returning to a clean hackathon starting point after an improvisational demo. It requires confirmation, then resets browser-stored calls, case numbers, assignments, unit statuses, radio transcript history, summaries, and agency configuration to the included sample setup. It does not affect Netlify hosting or the API credentials stored in Netlify environment variables. It does not delete data held in other browsers or workstations.


## v12: Voice dispatch matching
Outgoing radio commands can dispatch one or multiple units to a pending/active event by event number, full address, or uniquely matching incident type and street. The selected event does not override a different spoken event. Ambiguous or unrecognized events and busy/OOS units are held for review, not dispatched. Full transcripts remain saved when an event can be resolved. Test phrases: `3 Adam 12 respond to event 26-004519`; `3 Adam 12 and 3 Adam 14 respond to unwanted subject at 123 Main Street`. If case type is absent, create the call first with Call Taking.

### v12.2 repairs
- Recognize a unique numeric callsign at the beginning of the transmission (e.g. 321 -> 3A21), without confusing address numbers with callsigns.
- New Call for Service has an optional Custom Incident Type. Use this for Unwanted Subject or any other scenario.
- No existing browser records are reset during upgrade.

## v12.3 dispatch recognition
Outgoing voice dispatch accepts `321 respond traffic collision 123 Main Street` (without an explicit `to`) and Chrome transcription `three out of 21 respond traffic collision 123 Main Street` as 3A21 only if that identifier maps uniquely to a configured unit. The matched call updates its assigned units immediately and the dispatch status is shown in the interpretation. Older v10.1 non-dispatch handler no longer intercepts these outgoing response commands.


## v12.4: Spoken radio status normalization
Chrome may transcribe the spoken status “enroute” as “in route”, “on route”, or “en route”. The status interpreter now normalizes those forms before evaluating unit statuses, while saving the raw recognized transmission unchanged. Supports natural traffic such as “Three Adam Twenty One, copy, I'll show you in route” and short forms “321 in route”. Includes automated parser checks for all variants and negation handling.


## v12.5 voice recognition fix
Both manual/voice status updates and voice dispatch now use the same leading-callsign resolver. Examples: "three out of 21 I copy you in route", "321 copy show me enroute", and "Three Adam Twenty One respond traffic collision 123 Main Street" resolve to roster unit 3A21. If no single roster match exists, CAD holds the transaction for review. Original radio transcription is unchanged.


## v13 Audio Transcription
PTT now records compressed audio with MediaRecorder, sends it to `/.netlify/functions/transcribe`, and passes OpenAI's resulting transcript through the existing CAD rules. It uses the SAME `OPENAI_API_KEY` already configured for summaries. No key is shipped in browser code. `OPENAI_TRANSCRIBE_MODEL` optional, defaults to `gpt-4o-transcribe`. Chrome Web Speech runs as a fallback candidate if the service fails. Keep the site private or protect these public functions with auth/rate limiting before broad sharing. The endpoint accepts up to 3.5MB per request; PTT recording automatically stops after 30 seconds. Browser microphone permission is required.

## v13.1 incident completion and case requests
- Voice: "3 Adam 21 clear" releases unit; when the final unit clears without a dispo the call returns to Pending.
- Voice: "3 Adam 21 clear, dispo report taken" (also "arrest made" or "advice given") releases unit and closes the call when no units remain. Closed calls leave Active/Pending boards but retain history.
- Voice: "3 Adam 21 request a case number" allocates a persistent demo sequence in the format YY-C000001. Repeated requests return the same case number.
- Manual operations desk: supports clearing with disposition, automatic case numbers, and preset disposition suggestions.
- Multi-unit calls remain Active until every unit is cleared; the final unit's disposition determines closure versus return to Pending.
- Not connected to an agency's official records-number authority; generated case numbers are for demonstrations only.


## Version 14: Real street map and demo reliability

- The Operational Map now displays OpenStreetMap raster tiles via Leaflet. The map works from the Netlify-served web page as long as the visitor has internet access and the external tile provider is reachable. No AWS database or local GIS server is required. Map tiles are sourced from openstreetmap.org; Leaflet JavaScript and CSS are currently loaded from unpkg.com.
- Unit markers are **illustrative demo locations**, based on legacy pseudo coordinates. They are not GPS or AVL.
- Selecting an incident attempts to geocode its address through the OpenStreetMap Nominatim public API. Results are cached in that browser; when an address cannot be resolved, no incident map point is fabricated. Free public geocoding is suitable for occasional manual demo lookups, not bulk/production usage. Repeated/uncontrolled requests may be rate limited. For commercial CAD, use licensed map tiles and an approved geocoding provider.
- Save Demo Restore Point/Restore Demo Point use localStorage in the same browser profile. Export/Import JSON is provided for portability. Back up anything you want to keep before pressing Reset Entire Demo.
- Undo Last CAD Action reverses the latest supported voice or manual dispatch operation using an in-memory snapshot. Voice commands like “correction, disregard my last status” only reverse a preceding voice transmission. The correction adds an audit entry for any reversed changes to affected incident records. Undo history is lost on page reload; it is not a production transactional undo or distributed audit log.
- Multiple-unit incident lifecycle is retained from v13.1: a cleared unit is removed, but the call remains ACTIVE if other units are still assigned.
- Browser data are local to the device and profile. This is not a shared multi-dispatcher CAD nor real fleet GPS tracking.

### Smoke-test plan after deployment
1. Create two pending calls, dispatch 3A12 to one and 3A14 to the other by voice. Confirm each call has its own transcript/history.
2. Assign 3A16 to the first call, then clear 3A12. Confirm it remains ACTIVE with 3A16. Clear 3A16 with “dispo report taken”, confirm closure.
3. Set 3A14 ENROUTE by radio, say “correction disregard my last status”; confirm it reverts and logs correction.
4. Save a Demo Restore Point, change a unit status, restore, and confirm the prior state. Export JSON too.
5. Select a call with a valid Petaluma address; confirm tile map renders and the incident pin appears after geocoding. Unit markers are simulated, not live.


## v15 additions
- Eight seeded calls (six law and two fire) on fresh start/reset. On an untouched original three-call browser the additional five are added once without overwriting; modified user scenarios remain intact. Use Reset Entire Demo to load all eight if your browser already contains custom calls.
- EMS hospital-arrival status: “Medic 3 at the hospital” or “Medic 3 arrived at the hospital” changes TRANSPORTING to AT_HOSPITAL, retains any assignment, and does not make the medic available. A non-transporting status goes to review.
- Voice ad-hoc logon: “Medic 5 logging on”, “Engine 4 in service”, “3 Adam 30 logging on”. New recognized units enter AVAILABLE; existing assigned units aren't overwritten. Uses the existing OpenAI transcribe path. Manual add unit remains available.
- Voice logon and hospital changes can be undone via Undo Last Action.


## v15.1: multi-unit, multi-incident transmissions
One PTT recording may contain several independent unit status reports, including units assigned to different active events. The interpreter separates recognized unit clauses, associates each with its own assigned incident, and updates each separately. It preserves the complete utterance in the voice activity log and each unit clause in its incident radio transcript. Ambiguous transmissions remain in review; a single-incident selection is not blindly applied to multiple units.

Example: “Engine Two is on scene. Medic Two, clear. Three Adam Eighteen, clear.”

Do not reset existing browser state to use this update.


## v15.2 Fire Callsign Recognition
Voice logon supports Truck 1/T1, Battalion 1/B1 and Rescue units, in addition to Engine and Medic units. Spoken forms such as 'Truck One logging on', 'Battalion One in service', and 'Truck One on scene' match roster units. Callsign parsing is reused for dispatcher updates and multi-unit transmissions. Test browser voice results before presenting.


### v15.3 Units Monitor ordering
The Units Monitor is now sorted alphanumerically by unit identifier (natural numeric ordering) in every discipline filter. This changes presentation only; unit assignments, status updates, and storage order are unchanged.


## v15.4: Color-coded unit status monitor

The Units Monitor retains its alphanumeric unit sort and now shows distinct, high-contrast status pills for Available (green), Dispatched (purple), Enroute (blue), On Scene (amber), Code 4 (teal), Available on Scene (lime), Clear (slate), Transporting (magenta), At Hospital (rose), and Out of Service (red). Unknown statuses use the neutral default. Status text remains visible for color-blind accessibility. Existing units, browser data, assignments, audio and backend behavior are unchanged.


### v15.5 Board customization
Each Pending Calls, Active Incidents, and Unit Status board has its own agency/filter/sort controls. Incident boards can group by agency; units can group by agency or discipline. Drag the dotted column headings to reorder fields in each board. Drag the ⠿ grip in a board title to rearrange whole panels. Board preferences persist in browser localStorage and do not change CAD incident data. The Unit Status All/Law/Fire/EMS quick filters remain usable.


## v15.6: Dispatch conflict + PREEMPT
- Compact phonetic callsigns such as `3Adam12` are recognized without altering the original transcript.
- Busy units trigger a visible dispatch conflict with current incident ID, type and address; no assignments are changed.
- An explicit `PREEMPT` command atomically validates the destination and units, detaches committed units from their old events and dispatches them to the new event.
- Preempted events with no units return to Pending; audit events capture both directions of transfer.
- If unit identification, destination matching, or current assignment is ambiguous, PREEMPT is held for review.
- This is a demonstration workflow, not a live public safety dispatch product.

## v16 Intelligent Command Desk and CAD Board Intelligence
- Semicolon-separated independent CAD operations, each reporting success or a non-destructive review error.
- D, DE, E, OS, C4, AOS, A, T, AH, C, PRE, RT; `#4525` or full event number, grouped context `#4525: ...`.
- Type `#` for live event autocomplete: shows event ID, type, address, priority, and status; arrow keys/Tab/Enter select, Escape dismisses.
- Typed command `RT E1 Fire knocked down` attaches note to E1's assigned event; `RT #4525 Fire knocked down` attaches directly.
- Read-only CAD Board Intelligence answers board rundown, active/pending calls, available units, and unassigned P1 incidents from local state. Time-on-scene question uses statusChangedAt millisecond timestamps for status transitions after this upgrade; legacy on-scene statuses are marked timing unavailable rather than guessed.
- Voice questions about the board are answered textually in CAD Interpretation. No synthesized audio. No cloud AI invoked for board facts.
- The voice dispatch engine remains separate from the typed command parser. Operational actions remain local demo state.


## v16.1 drag-dispatch controls
Move the command bar with its placement dropdown (top, below boards, bottom). Saved per browser. Drag a unit row onto a Pending or Active CFS row to dispatch. Busy units are blocked with a visible conflict and require explicit PRE. Drag a unit onto the Units panel to release it and return it to AVAILABLE; if the last unit is released without a disposition, the call returns to Pending. Both actions are recorded in incident history. This is a browser-only demo; test in Chrome before a presentation.
 Assigned unit chips on Active calls are also draggable back to Units Status for release.


## v16.2 — Incident map follow and Home
- Selecting an incident from Pending or Active pans and zooms the real Leaflet/OpenStreetMap map to its geocoded address (when available).
- A Home (house) button in the map's upper-left control stack returns to a citywide Petaluma view.
- Late geocoding responses do not override newer incident selections.
- Missing/unresolved addresses show a notification instead of a fabricated coordinate.
- Markers represent geocoded addresses and simulated units, not AVL/GPS.


## v16.6 multi-monitor workspace support

- Use **↗ Pop Out** on Pending, Active, Units, Incident Detail, Map, Command Line, Voice Intelligence or Board Intelligence to create a standalone browser window. Drag that window using the OS title bar to another monitor. Browser page elements cannot be dragged directly across top-level windows using HTML drag/drop.
- Open Saved Windows opens the set of previously popped-out panels for the selected saved workspace. A pop-up permission prompt may be required, and some browsers block opening several windows from one click.
- Same-origin windows share localStorage; browser storage events refresh CAD state on other windows in the same browser profile. This is **not** shared, multi-user, multi-computer server synchronization. Concurrent cross-window writes are not transaction-safe and should not be relied upon for operational use.
- The browser controls physical window position; automatic placement on a specific monitor is not guaranteed. Arrange manually.
- Refresh to load the latest state if a detached panel is stale.


## v16.7 — Dedicated Board Intelligence microphone
- Board Intelligence has its own Hold to Ask PTT using the existing Netlify `transcribe` function and the same `OPENAI_API_KEY`.
- Its transcript goes ONLY into the read-only board-question evaluator; it cannot dispatch, clear, or change an assignment.
- Optional Speak answer checkbox uses browser text-to-speech, off by default.
- Refreshed dark-mode Ask CAD and example-question buttons.
- OpenAI recording requires Chrome microphone permission and an internet connection. Live audio/browser verification remains necessary.


## v16.8: Independent panes and real Pop Out
- Pending, Active, Unit Status, Detail, and Map use independent vertical lanes; resizing one board no longer stretches the board beside it.
- Drag a board grip to a different lane or place it before another board. Positions are saved to browser storage and included in named workspaces.
- Pop Out opens one working copy in a new window and replaces the original pane with a compact return placeholder. Close the window or click Return to restore the original pane.
- Pop-outs still use browser-local storage and are for a single operator's demo, not a production multi-console state engine.


## v17.1 Command pane drag fix
Drag the COMMAND heading or any empty area of the command-pane background to reposition the command window. Click and type within the input normally; Execute and autocomplete remain interactive. Resize using the bottom-right handle. The saved freeform workspace still persists coordinates and dimensions.


## v17.3 Narrative scrolling, ordering, and unit status chips
- Event Narrative and Radio Transcript scroll within the resized Incident Detail pane.
- Order selector supports Newest on top (default) and Newest on bottom; this is a display-only setting saved in browser localStorage.
- Assigned-unit chips on pending and active incident boards use the same status palette as the Units Monitor.
- No modifications to dispatch, voice recognition, or persisted incident chronology.


## v17.4 update
- Unit Status board now renders each unit ID as a color-coded pill matching the current unit status.
- The right-side status pill remains for explicit readability, while the left-side unit pill gives fast visual recognition.

## v18.1 — Voice disposition clearance
Fire, EMS, and Law voice clearances accept descriptive dispositions (e.g. "Engine One clear with disposition false alarm", "Medic Two clear, patient refusal"). Closing the last assigned unit with a disposition closes only that incident, not its linked cross-discipline incidents. Regression check: `node tests/voice-clear-regression.js`.


## v18.2 — Operational reliability bundle
- **Linked incident navigation:** Incident Detail shows clickable Police/Fire/EMS family event pills, including closed related incidents, with current incident visually marked and disabled. Selecting a pill switches to its incident detail. Boards show LINKED labels.
- **Voice explanation:** Voice Interpretation explicitly displays the words recognized, matched units and event, requested action, and applied action or review/hold explanation for dispatch, radio updates, and clearances. OpenAI transcription output remains available in Voice Heard.
- **Retained v18.1 clearance hardening:** Fire, EMS and law descriptive dispositions can close their own incident after its last unit clears, leaving other disciplines alone.
- **Regression checks:** `node tests/linked-incidents.test.js`, `node tests/voice-clear-regression.js`, `node tests/linked-navigation.test.js`. Run all before deployment.

### Manual Chrome verification
1. Dispatch E1 from law incident 26-004518: one linked Fire call should appear and E1 should be dispatched there.
2. Dispatch E2 to same emergency: it should reuse that Fire call.
3. Dispatch M2 to law event: it should create one separate EMS call.
4. Select any of three incidents; use the linked pills to navigate all three, including closed records.
5. Clear E1 with a disposition while E2 remains: Fire call stays active. Clear E2 with a disposition: Fire call closes; Law/EMS are unchanged.
6. Try dispatching a busy unit without preemption: no reassign; review explains the conflict. With preemption: verify previous incident history records the move.
7. Speak an unrecognized callsign: no operational status change and visible review.
8. Use typed command and drag-and-drop to verify they follow the same cross-discipline incident rule.
9. Verify existing user-created incidents persist across update; **do not reset demo data**.

Browser localStorage is used for CAD state; this remains a single-user prototype, not a synchronized multi-user CAD backend.

## v18.3: Radio-driven incident reclassification (hackathon demonstration)
The system can recognize a confirmed new call type in radio traffic while updating a responder's status (e.g., "E1 on scene, confirmed working structure fire"). Reclassification preserves the CAD event number, assigned units, and existing narratives, and adds an auditable before/after classification entry in `classificationHistory` and event history. Supported prototype terms include Structure Fire, Vegetation Fire, Vehicle Fire, Fire Alarm, Cardiac Arrest, Medical Aid, Overdose, Burglary, Robbery, Domestic, Traffic Collision, and Welfare Check. Ambiguous/unconfirmed reports are held for review. Cross-discipline type changes are also held.

Additional dispatch can target the **new** call type plus location, the full incident address, a unique incident number, or a responding unit's location (e.g., "Start E2 to Engine 1's location"). Radio dispatch still respects unit availability and linked-incident rules. A type-only reference must uniquely identify one open incident. The prototype is not production CAD; radio recognition and multi-command phrasing require browser/live microphone verification.

Test: `node tests/reclassification.test.js` and other `tests/*.js`.


## v18.4 — Multi-unit Voice Fix
- Process all explicitly named units in a single voice dispatch (e.g., Engine 2 and Engine 3).
- Log on multiple named units in one transmission (e.g., Battalion 1 and Truck 1), creating demo units where needed.
- Preserve assigned-unit safety checks; an existing active assignment is not overwritten by logon.
- Handle a common speech-to-text misspelling of Battalion.
- Regression script: `node tests/multi-unit-voice.test.js`.
- Note: Chrome microphone recognition and live dispatch still require browser verification.

## v18.5 — Voice requests, configuration, field-initiated calls
- Voice: "Copy 3A21 requesting a case number" now matches the case-number request intent. As before, there must be precisely one associated active incident; a case number is not assigned if the unit/incident is ambiguous.
- Reclassification recognition consults the configured Police, Fire and EMS CFS lists, not only built-in terminology. Configuration is saved in the current browser.
- Voice: "3A21 Traffic Stop 123 Main St blue Toyota 4Runner CA 2WNP196" creates a LAW Traffic Stop with the source transcript, location, vehicle description, plate, and unit on-scene. Only a known, AVAILABLE/CLEAR law unit and an explicit street address can initiate the call. Ambiguous or already committed units do not create incidents.
- "Traffic Stop" is non-destructively added to any existing LAW call-type list and included in new installations.
- This is a local-browser demo. The prototype does not validate vehicle registrations, addresses, or perform production-grade speech entity extraction; verify recognition and audio in Chrome.

## v18.6 — Natural radio traffic-stop recognition
Accepts “3A12 is on a traffic stop, 1562 Henry Way…” and phonetic license plates e.g. “California 2 William Nora Paul 196”. Previously the narrow traffic-stop regex skipped the phrase, resulting in “No status command detected.” Adds regression coverage of the exact screenshot transcription.

### v18.7 Natural callsign correction
- Recognizes possessive callsign phrases such as “Three Adam Twelve’s on a traffic stop”.
- Converts spoken house number “fifteen sixty-two” into 1562 in this field-initiated stop path.
- Keeps phonetic plate decoding and safeguards from v18.6.

## v19.0 radio parsing refinement
Handles ASR pluralization such as “Three Adam Fourteens” for unit 3A14. Regression tested locally using the exact reported transcript. Local sandbox browser navigation was unavailable; test live microphone path after deploy.


## v19.1 combined arrival/reclassification/dispatch
A single radio message reporting on-scene confirmation and directing additional named responders runs the arrival/reclassification through the normal status handler before dispatching only the additional units. Independent review feedback is retained for each operation. Full end-to-end microphone testing remains necessary.


## v19.3 — Situational Awareness Map
- Distinct police, sheriff, fire, and EMS unit symbols with colors reflecting current operational status.
- Unit popups display reported location, current status, linked call number and type; marker positions are simulated, not actual AVL.
- Filter incident overlays: Active, Pending, or Both, with priority and discipline markers. Locations use approximate OpenStreetMap Nominatim geocoding.
- Satellite/street basemap toggle beneath the citywide Home button using Esri World Imagery. Requires internet.
- Independent map question field and hold-to-talk audio button: P1 calls, locating a unit, available units, active/pending calls, and units assigned to an incident. Voice audio uses the existing Netlify transcription function. Map inquiries never change CAD state.
- Map voice queries are intentionally rules-based and bounded to known operational query patterns; arbitrary natural-language map interpretation is not promised.


## v19.5 — Hydrants, marker offsets, and structured CAD commands
- City of Petaluma Water Hydrants (ArcGIS LUCITY Water Distribution layer 6) via Netlify read-only proxy. Hidden by default; button or map voice query enables it. 
- `show all fire hydrants` or `show fire hydrants around event #4525`. The event query displays the selected event and hydrants within 650 meters.
- City hydrant data is unverified reference-only, not a validated operational fire-flow source. GIS availability and geocoding require internet.
- Unit and incident markers use compact icons, offset for legibility, with anchor dots and leader lines.
- `CL 3A12 @1562 Henry Way@` changes unit reported location, geocodes it and updates map and Unit Status board. No GPS/AVL is implied.
- `TS 3A12 @1562 Henry Way@ .SAM123. ,red Toyota truck` creates an on-scene law Traffic Stop (available units only).
- Address autocomplete suggestions appear while typing within an @address@ segment. Accept a suggestion before executing for best accuracy. Failed geocoding leaves the reported address visible with a simulated approximate point, not a false precise location.
- `@...@` address, `. ... .` plate/person identifier, and `,` narrative are for **CL and TS** in this demo; existing command syntax is preserved.

## v19.6 — Flexible GeoCAD commands and typed natural language
- `CL` and `TS` can appear in any order relative to known unit IDs, `@address@`, `.plate/person.`, and `,narrative` fields.
- If narrative is in the middle of a command, delimit it as `,remarks,`. A lone comma marks trailing remarks. If another explicit unit token follows, it is extracted from the remarks as the unit, though using paired commas is clearer.
- Examples: `@1562 Henry Way@ ,red Toyota truck, .SAM123. 3A12 TS` and `CL @1562 Henry Way@ 3A12`.
- Stage 2 first pass: typed natural language for bounded, unambiguous Traffic Stop and Change Location requests (e.g., `3A12 is stopping a red Toyota truck at 1562 Henry Way, plate SAM123`). This uses deterministic local intent/entity matching and the exact same safety/dispatch transaction path; it is **not** unrestricted LLM interpretation.
- Ambiguous or incomplete instructions return a review message; unsupported natural-language actions are not guessed. The application uses OpenAI for speech-to-text elsewhere, but this newly added typed fallback does not call the model.
- Added `tests/structured-command.test.js`, including variable field orders, conflicting unit IDs, natural-language entries, and required-location guards.
- Important: This remains a demo with local browser state. Geocoding and hydrant layers require working online services and still need browser testing.


## v19.7 — Configurable self-initiated calls for service
- In Configuration, add a CFS type under LAW, FIRE or EMS, save it, then enable Self-Initiated for that type, assign an optional unique code (e.g., ATC), and choose ENROUTE, ON SCENE, or DISPATCHED as the default unit status. Save Configuration again.
- Typed example: `ATC 3A12 @123 Main St@ ,attempt to contact` creates an active Attempt to Contact and moves 3A12 ENROUTE if configured that way. The command code/unit/location may appear in different orders (within the delimiter rules).
- Voice example: `3A12 I'll be enroute to 123 Main St for an attempt to contact` recognizes a configured, enabled self-initiated type and explicit ENROUTE status. Voice matching is bounded to explicit configured call-type phrases and clearly spoken unit IDs / street addresses, not open-ended model inference.
- An explicit spoken ENROUTE or ON SCENE overrides the default; otherwise the configured default applies. Only known, eligible, available units can create an incident.
- Existing `TS` and Traffic Stop voice functions remain supported, with the optional configured starting status respected. No database migration; configuration is saved in browser localStorage.
- The previous v19.6 features are included. The live microphone/geocoder path still needs field testing.


### Interface cleanup
- Removed legacy Pop Map and Pop Units buttons.
- Removed the redundant full-width navigation bar and kept Dispatch, Call Taking and Configuration navigation in the main header.
- Existing workspace multi-monitor windows remain available via the Workspace toolbar.

## v19.8 Event clearance
- `CE #4525 ,report taken` clears the matched incident, requiring a nonempty disposition.
- Right-click an Active or Pending incident row to open the Clear Event dialog, or use Clear Event from Incident Detail.
- A closure releases all assigned units, preserves the disposition and timestamp, and writes an Event History entry. Linked incidents are unaffected.
- Configuration includes editable disposition suggestions by discipline; free-text dispositions remain available.
- These prototype settings use localStorage and are not centrally shared across agency workstations.


## v19.9 — Common Places and Configuration sections
- Configuration selector: Calls for Service, Self-Initiated CFS, Common Places, General & Other Settings. Existing settings remain saved through Save Configuration.
- Common Places directory with optional aliases, explicit address-search result selection, stored coordinates, edit/delete, duplicate-alias rejection; records persist in this browser only.
- Typed CAD commands with `@alias@` and voice-processing text containing a configured alias resolve to the validated address. Call Taking and configured self-initiated creation also resolve exact aliases.
- Maps resolve a known common place using its stored coordinates. If the address is not available, normal geocoding is used.
- Prototype limits: Browser-local, public address service availability required for verification, name recognition works on exact configured name or alias rather than fuzzy conversational synonyms; no agency-wide synchronization.

## v20.0 — Common Places resolution repair
- Typed structured commands preserve @PHS@, resolve the saved Common Place to the verified address, and reuse saved coordinates.
- Voice self-initiated calls resolve configured place names and aliases *before* geocoding, without rewriting radio transcripts into duplicate long addresses.
- Existing entries saved with verbose Nominatim labels are normalized at read time; no Common Places re-entry required.
- Tested `FU 3A22 @PHS@` and `3A22, I'll be on a follow-up at Petaluma High School` using a previously saved common place.
- To use FU, configure Follow Up as an enabled self-initiated LAW CFS with short code FU; otherwise it is not an active command.

## v20.1 Follow Up voice and incident cards
- Accepts radio phrases such as "Three Adam Twelve, I'll be out at follow up at Petaluma High School" using an enabled Follow Up self-initiated CFS configuration.
- Uses established radio unit recognition in the self-initiated handler.
- Renders saved Common Place names above the physical address in incident board cards, including existing incidents whose address matches a saved place.
- Retains explicit `@PHS@` delimiter requirement for typed commands.

## v20.2 — Flexible self-initiated voice announcements
The voice self-initiation handler now accepts common variations such as "I'll be out at", "I'll be on", "out for", "I'll be out on", and bare configured CFS announcements, provided one unit and a recognizable location can be resolved. These patterns apply to any enabled self-initiated CFS, not just Follow Up. Added regression cases for the exact examples and for Property Check. Ordinary dispatch, cancellations and tentative reports are kept out of this branch. Speech recognition remains external and browser microphone behavior requires live verification.

## v20.3 voice and command diagnostic update
- Common-place alias matching and configured call-type lookup are case-insensitive.
- Self-initiated calls recognize equivalent CFS labels regardless of capitalization and common punctuation.
- A detected self-initiated voice request that lacks a unique unit or location now produces specific review feedback instead of silently falling through to "No status command detected".
- The address suggestion service no longer replaces an exact agency Common Place alias with public-geocoder results.
- Regression examples include `fu 3a12 @phs@`, `Fu 3A12 @PHS@`, "Three Adam Twelve, out on follow up at Petaluma High", and "3A12 follow-up PHS".
- Operational safeguard: a unit already committed to an active incident cannot self-initiate a second incident; the system will report this explicitly.

## v20.4 Voice Unit Recognition Repair
- Fixed self-initiated CFS unit lookup, which previously relied on a private `voice.js` function not accessible to the self-initiated module.
- Independent recognition of spoken and typed callsigns, including Three Adam Twenty Two -> 3A22.
- Regression tests now omit the incorrectly mocked global unit matcher and exercise multiple real callsign phrasings.


## v20.5 — Generic voice CFS article matching
Recognize configured self-initiated CFS names with optional articles between words, such as Out With Subject = out with a subject = out with the subject, without agency-specific hardcoded phrases. Includes exact radio transcript tests for 3A12 at 900 B Street.


## v20.6 — spoken street addresses in self-initiated radio traffic
- Convert spoken house numbers such as “four twenty nine” into 429 and “fifteen sixty two” into 1562 within the self-initiated incident address parser, while preserving the original radio transcript.
- Accept addresses following an explicit preposition (“at 429 Douglas Street”) or after a comma (“out with a subject, four twenty nine Douglas Street”).
- Includes exact failing radio phrase as an incident-creation regression test.
- Parsing an address is not verification that it exists. An unknown address still requires geocoding/operator validation; demo incident creation remains local-first.


## v20.7 - Map Filter & Hydrant Extent
- All/Law/Fire/EMS unit filter now controls Units board and operational map in unison.
- Turning on hydrants preserves the current map zoom and center; requests local GIS points, not citywide ones, and shows only markers within the visible viewport.
- Voice hydrant requests naming an incident, such as 'hydrants around the structure fire at 450 E Washington St', center on the incident and show nearby hydrants without zooming out to the whole city.
- City GIS hydrants and simulated unit positions remain reference only.


## v20.8 Public Safety GIS Layers and voice navigation
- New **Layers** selector: hydrants, fire stations, fire hazard zones, WUI, evacuation zones, flood zones, police beats, sheriff patrol zones, address points, building footprints, schools, and parcels. Default unchecked. Detailed reference data is restricted to closer zoom levels.
- Road closures and traffic incidents are listed disabled pending a verified feed; the CAD never invents live road status.
- Voice map prompts can show, hide, exclusively show or clear available layers. Layer toggles never zoom or recenter.
- Location-navigation requests explicitly recenter and zoom to geocoded addresses, configured common places or identified incidents. Example: “take me to Petaluma High School” or “zoom to 450 E Washington Street.”
- GIS layers are fetched from official published services to the map's current bounds; they may be unavailable due to CORS, rate limits or provider outages. Reference GIS data is not validated for emergency operations.
- Not yet end-to-end verified in a browser with real GIS feeds; syntax checks completed.
