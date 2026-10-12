# CAD architecture and incremental refactor plan

## Current baseline (v20.8)

This is a browser-based, static CAD proof of concept. `index.html` loads `styles.css` and independent JavaScript files. Netlify Functions in `netlify/functions` provide optional server-side endpoints. The existing behavior and agency configuration are retained.

## Functional boundaries

- Dispatch state and application wiring: `app.js`, `operations.js`, `extended-ops.js`
- Incident intelligence and workflow: `incident-intelligence.js`, `self-initiated.js`, `event-clear.js`, `structured-command.js`
- Voice and language understanding: `voice.js`, `ask-cad-voice.js`, `voice-incident-creation.js`, `command-intelligence.js`
- Map and geospatial layers: `map.js`, `map-layer-catalog.js`, `common-places.js`
- Layout and multi-monitor: `board-layout.js`, `pane-layout.js`, `workspaces.js`, `multi-monitor.js`, `free-workspace.js`, `drag-dispatch.js`
- Integration boundary: `netlify/functions/`
- Regression tests: `tests/`

## Safe refactor sequence

1. Commit the unchanged v20.8 release and tag it `v20.8-baseline`.
2. Add automated regression validation and smoke-test the static app and Netlify Functions.
3. Extract pure parsing and voice-command matching functions, preserving all command aliases and agency-wide configuration.
4. Separate map viewport management from map layer toggling. Layer toggles must never change zoom or center.
5. Isolate dispatch state from DOM rendering and add focused tests for unit discipline filtering.
6. Make module interfaces explicit, with backwards-compatible adapters where needed.
7. Preview on Netlify before changing the existing production site linkage.

## Public repository precautions

Use fictional demonstration data only. Never commit real CAD/911 records, credentials, secret keys, or personally identifying information. This is not suitable for operational emergency dispatch.
