# CAD architecture and refactoring roadmap

## Current architecture

This is a browser-local demonstration CAD, not a production dispatch system. `index.html` loads global browser scripts; `app.js` owns demo records and persistence, `voice.js` interprets radio/voice interactions, `map.js` renders the Leaflet map, and `map-layer-catalog.js` manages viewport-scoped GIS overlays. Netlify Functions supply optional backend capabilities.

## Safety and compatibility rules

1. Preserve existing localStorage keys and saved demo data across refactors.
2. Keep script load order and global interfaces stable until regression tests cover replacements.
3. Do not change live Netlify deployment or secrets.
4. Preserve map center and zoom when GIS layers are toggled.
5. Preserve LAW/FIRE/EMS unit filtering and agency-configured voice phrases.
6. Use only fictional demo incident/person data in this public repository.

## Incremental refactoring

- Phase 1: repository hygiene, checks, documentation and CI (this branch).
- Phase 2: extract pure state and command utilities with focused unit tests.
- Phase 3: isolate voice parsing from browser recognition and operational mutations.
- Phase 4: isolate map data queries, overlays and geocoding from Leaflet presentation.
- Phase 5: browser smoke tests and Netlify deploy preview before changing production configuration.

## Local validation

`npm test` runs the existing Node regression suite. `npm run check` checks JavaScript syntax and runs tests. These do not replace microphone, multi-monitor, and GIS integration testing in a browser.
