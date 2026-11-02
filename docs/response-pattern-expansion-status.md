# Response plan enhancement coverage, Draft PR #33

Closest-unit/ETA selection is deliberately **out of scope** for this CAD environment. Recommendations continue to use explicitly configured unit order only.

## Implemented on feature branch (not deployed)
- `core/response-pattern-rules.js` read-only schedule evaluator: agency-local time zone, weekday schedules, overnight shifts, effective/expiration ISO timestamps; dispatch area plus ordered optional subdivision levels, up to five.
- Response engine uses these criteria when selecting active plans, with specificity ranked above generic matches.
- Visual designer fields for the optional schedule and area/subdivision hierarchy. Saved in the existing plan JSON model only if its existing agency settings save pathway is permitted. Acceptance lab still disables writes.
- `resourceLogic.mode='OR'` with `options`: ordered alternatives; only a complete candidate may be recommended.
- `resourceLogic.mode='GROUP'` with `resources`: no unit IDs returned unless the entire group is recommendable.
- Additional automated tests cover schedules, hierarchy, grouped requirements and alternatives.

## Still incomplete (do not mistake for operational readiness)
- Visual editor controls for creating OR/GROUP response blocks and notes.
- Date/time simulation controls in acceptance lab and browser acceptance of the new fields.
- Agency-configured hierarchy labels and authoritative incident geographic subdivision source.
- CSV template import/export, mapping, conflict preview and validation.
- Live dispatch atomic assignment semantics for GROUP responses; read-only recommendations are not an all-or-nothing transaction.
- Real personnel count and validated staffing source, and all authenticated persistence and concurrency tests.
- Validate overlapping scheduled plans and ambiguous matches, full activation validation, and alarm tier interplay with OR/GROUP before deployment.
- Existing response plan activation and server persistence do not yet enforce these new schedule rules.
