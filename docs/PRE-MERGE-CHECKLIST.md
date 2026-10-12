# Pre-merge release gate for CAD concept

Target PR: #1, `refactor/quality-foundation` into `main`.

## Automated requirements
- [ ] Latest head commit has a successful **Validate CAD** GitHub Actions run.
- [ ] Review the PR diff for accidental credentials, backend configuration, or unrelated product changes.
- [ ] Verify no unresolved conflicts with current main.
- [ ] Confirm all new scripts are loaded from index.html in dependency order.
- [ ] Confirm original dispatch, incident, unit, voice, and GIS regression scripts still pass.

## Manual acceptance, mandatory before merge
- [ ] Open the refactor branch in a local web server and test on desktop.
- [ ] Confirm dispatch and call-taking flows still work using fictional data.
- [ ] Test voice transcript parsing, unit status changes, and multi-unit commands.
- [ ] Test ALL/LAW/FIRE/EMS unit filters and map marker visibility.
- [ ] Test map layers and voice layer requests; zoom and center must not change.
- [ ] Test Voice Phrases add, edit, delete, JSON validation, persistence and full demo reset.
- [ ] Confirm recognized phrases in the configuration editor cannot execute CAD actions.
- [ ] Inspect browser console for uncaught errors.
- [ ] Repeat critical layouts on mobile/tablet and verify accessibility basics.

## Release boundaries
- This PR is **not** agency-wide shared voice phrase storage; localStorage is per-browser.
- This PR is **not** a production command authorization engine; action plans never execute.
- Supabase/Auth/RLS and backend persistence are planning only, not implemented.
- Do not merge or deploy without the repository owner's explicit approval.
- After merge, deploy only via the owner's existing deployment workflow and smoke-test the demo.

## Rollback
- Keep a record of the last known-good main commit and deployment.
- If smoke tests fail, revert the merge commit and redeploy the previous known-good build.
- Do not delete user data or change backend resources as part of this refactor.

Status: Automated checks can be green while real-browser acceptance remains incomplete.
