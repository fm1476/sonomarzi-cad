# Supabase support request: development branch migration replay failure

**Parent project ref:** `gtmdigvuwjyfpgpdjmph` (sonomarzi-cad)
**Branch name:** `cad-response-plan-pr33-validation`
**Branch project ref:** `hssahnyxefqevtnnlhei`
**Branch ID:** `ee3ec0fa-1a5b-4324-8c04-18cb503932ed`
**Created:** 2026-11-02 04:35:33 UTC
**Observed branch status:** `MIGRATIONS_FAILED`
**Branch deleted:** yes, to stop hourly billing.

## Impact
The isolated test database never reached a usable CAD schema. Read-only queries against the branch showed `to_regclass('public.cad_incidents')` and `to_regclass('public.cad_agency_config_documents')` as NULL. No application migration was applied.

## Evidence
- Parent migration history continued beyond October 2026 through `20261102035240 cad_cfs_allow_discipline_changes`.
- Failed branch migration history contained five migrations, last completed `20261001015437 fleet_inspection_personnel_validation`.
- Next entry on parent: `20261001020741 staff_notice_per_user_clear`, but **this is not confirmed as the failed migration**.
- The next migration references `public.suite_notice_recipients`, `public.suite_notices`, `public.suite_memberships`, `suite_private.context_allowed`. All referenced objects exist on parent. The first migration contains the table definitions.
- Parent project unified logs for 2026-11-02 04:30–05:00 UTC contained two normal postgres checkpoint entries and one storage request. No migration failure detail.
- Following deletion, branch listing shows only main.

## Request
Please provide the first actual failing migration statement, full PostgreSQL error code/message, and branch provisioning job context for branch ID above. We need to distinguish historical migration replay incompatibility from transient branch provisioning failure. Please advise whether any migration history repair is appropriate before recreating a branch.

## Safety constraints
Do not change the parent project, merge branches, or re-run paid branch creation without explicit authorization. We can provide migration SQL upon request.
