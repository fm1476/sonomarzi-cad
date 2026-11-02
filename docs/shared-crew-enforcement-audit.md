# Shared-crew enforcement audit, November 2026

**Read-only production schema inspection. No database changes.**

The CAD production project already has shared-crew enforcement in these five live PostgreSQL RPC functions:

| Function | References `cad_shared_crew_units` | Uses agency assignment lock (72361) |
| --- | --- | --- |
| `cad_assign_unit` | Yes | Yes |
| `cad_assign_response_plan` | Yes | Yes |
| `cad_join_unit_on_scene` | Yes | Yes |
| `cad_preempt_unit` | Yes | Yes |
| `cad_preempt_join_unit_on_scene` | Yes | Yes |

The first two functions were inspected in detail:
- `cad_assign_unit` checks whether sibling apparatus is on an active assignment and rejects with `Shared crew is already committed`.
- `cad_assign_response_plan` rejects conflicting members of shared crews within a proposed batch and against existing active assignments, recording `SHARED_CREW_BUSY` in the unfilled result. This RPC permits a *partial* batch, so the UI must be explicit about unfilled resources and must not claim all-or-nothing response plan dispatch.
- Both serialize with an agency advisory transaction lock keyed by `72361`.

**Caveats:** The other three functions were checked for references and lock presence only, not comprehensively validated for correct execution order or every edge case. A trigger-level audit is still required to confirm that no alternative database write path can bypass these checks. The new crew-membership save RPC proposal currently uses a different lock key (68237); before enabling it, align its transaction with the assignment lock (72361) to eliminate membership edits racing assignments. Audit the current save design for safe removal and rename behavior, and ensure failed branches are not recreated without renewed cost authorization.

**Status:** This is evidence of existing safeguards, not completed authenticated/concurrency testing. Draft PR #33 remains unmerged and no production changes were performed.
