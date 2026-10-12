# CAD browser acceptance checklist

Run on the draft branch in an isolated local browser profile using fictional data. Do not use operational dispatch data.

## Map and units
- Select ALL, LAW, FIRE, EMS on the unit board. Confirm map markers match the selected discipline.
- Pan and zoom to a small area; turn on hydrants, schools and parcels. Confirm map center and zoom do not change.
- Speak "show hydrants", "hide schools", "show only parcels", and "clear all layers". Confirm layer selection and viewport remain correct.
- Confirm a layer request does not dispatch or alter any units.

## Voice phrase preview
- Navigate Configuration > Voice Phrases.
- Add a second alternative to an existing action. Confirm previous alternatives remain listed.
- Test an exact phrase; confirm it reports the canonical intent and performs no CAD action.
- Test an unknown phrase; confirm it does not resolve.
- Attempt to assign the same phrase to two different intents; confirm a conflict warning and no save.
- Save, refresh the browser and confirm the phrases remain.
- Load invalid JSON, duplicate intent groups, normalized duplicate phrases and empty phrase arrays; confirm validation blocks them.
- Switch the action selector during editing; confirm replacement mode clears.
- Simulate malformed saved configuration; confirm safe defaults are displayed with a warning and the saved value is not silently overwritten.
- Remove a phrase group, save, refresh and confirm it stays removed.
- Reset the entire demo and verify the voice phrase preview is cleared as expected (implemented in the refactor branch).

## Regression
- Run `npm run check`.
- Test existing typed commands, radio voice transcripts, incident creation, unit assignments and status changes.
- Confirm no console errors, no unintentional map recentering and no browser storage migration.
- Verify mobile/tablet layouts before considering PR merge.

**Not yet completed:** manual browser acceptance. This is a checklist, not a claim of testing.
