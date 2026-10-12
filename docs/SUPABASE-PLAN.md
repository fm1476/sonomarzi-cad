# Optional Supabase data layer: design only

This is a proposed future backend, **not enabled** in the current release. Keep local browser demo storage as the default until multi-workstation workflows are tested.

## Boundaries

- Browser components call an abstract CAD repository API rather than directly manipulating Supabase tables.
- Supabase Auth identifies dispatchers and agency membership.
- Every operational table includes an agency/tenant ID with database-enforced row-level security.
- A single authenticated operation updates incident assignment and unit status atomically; do not use independent client writes.
- Realtime subscriptions announce committed changes and trigger re-reads; they do not replace server authorization or conflict control.
- Keep an immutable event history for incident, unit, and operator changes.
- Persist agency-wide command aliases separately from per-user voice settings, with an audit trail.
- Browser localStorage remains suitable only for fictional, standalone demo data.

## Candidate tables

| Table | Purpose |
| --- | --- |
| agencies | Agency identity and configuration |
| memberships | Authenticated agency roles |
| units | Unit roster and current status |
| incidents | Incident master records |
| incident_units | Assignments and dispatch timestamps |
| incident_events | Append-only narrative and status history |
| command_aliases | Agency-specific phrases and canonical intents |
| map_preferences | Optional agency and operator layer defaults |

## Rollout sequence

1. Create schema and RLS policies in a separate development Supabase project.
2. Add an optional repository adapter and mock integration tests.
3. Demonstrate two authenticated browser sessions receiving incident and unit updates.
4. Exercise stale-write rejection, tenant isolation, disconnection and reconnect.
5. Only then evaluate changing the default storage mode.

Never commit service-role credentials or real public safety data to this public repository.
