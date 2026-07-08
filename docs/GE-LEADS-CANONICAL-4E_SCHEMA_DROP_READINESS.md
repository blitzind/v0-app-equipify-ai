# GE-LEADS-CANONICAL-4E — Legacy Lead Inbox Schema Drop Readiness

**Status:** Draft readiness — no destructive migration applied.  
**Production:** `growth.lead_inbox` = 0 rows; Revenue Queue = canonical `growth.leads` only.

## Dead code removed (runtime)

| Symbol / path | Action |
|---|---|
| `loadLeadInbox`, `fetchLeadInboxById`, `updateLeadInboxRow` | Removed from `lead-inbox-repository.ts` |
| `claimLead`, `assignLeadOwner`, `promoteToPipeline`, `archiveLead`, `markDuplicate`, `disqualifyLead`, `saveLeadInboxMetadataPatch` | Removed |
| `saveOperatorHandoffToLeadInbox` | Removed from `operator-handoff-repository.ts` |
| `loadDuplicateInboxContext` + inbox `.from("lead_inbox")` in intake bridge | Removed |
| `isGrowthLeadInboxSchemaReady` / `lead-inbox-schema-health.ts` | Deleted (uncalled) |
| `certifyRevenueQueueProjectionParity` legacy inbox compare | Rewritten canonical-only |

## Remaining references (classified)

### Adapter naming debt (keep until UX rename)

- `GrowthLeadInboxRow`, `GrowthLeadInboxCardView`, `buildPseudoInboxRowFromGrowthLead`
- `lead-inbox-dashboard.ts`, `lead-inbox-card-view.ts`, `lead-inbox-priority.ts`, `lead-inbox-status-engine.ts`
- API route `/api/platform/growth/lead-inbox` (stable URL, canonical behavior)
- `loadOperatorHandoffFromLeadInbox` (reads metadata on pseudo inbox row)

### Schema migration blockers (must clear before drop)

- `lead_inbox_id` on `search_intent_signals`, `buying_stage_assessments`, `company_identification_matches` — repos still write null + `.or(growth_lead_id, lead_inbox_id)` reads
- `growth.signals.lead_inbox_id`, `processed_to_lead_inbox`
- `growth.prospect_search_index.is_in_lead_inbox` + TS field `in_lead_inbox` / `lead_inbox_id`

### Active runtime (non–lead_inbox table)

- `createLeadCandidate`, intake loader, dedupe (`externalRef: lead_inbox:{hash}`)
- Intelligence persist with `lead_inbox_id: null` + `growth_lead_id`
- Prospect search push actions (`push_to_lead_inbox` action id — canonical target)

### Archived / test / cert only

- Cert scripts counting `lead_inbox` rows (4b, 4d, 4e, 3e smoke)
- `supabase/migrations/20270317120000_growth_engine_lead_inbox.sql` (historical)
- Reset inventory entry for deprecated table
- `docs/GE-LEADS-CANONICAL-4E_SCHEMA_DROP_DRAFT.sql`

### Safe to delete later (after column drop)

- `resolveCanonicalLeadForDuplicateInbox` (deprecated shim)
- Legacy cert scripts 3b–3e (superseded by 4d/4e)

## Schema drop readiness

| Step | Ready? | Blocker |
|---|---|---|
| Drop FKs to `growth.lead_inbox` | No | Intelligence columns still exist + repo fallbacks |
| Drop `lead_inbox_id` on intelligence tables | No | Repository `.or()` transition reads |
| Drop `signals` legacy columns | No | Signal foundation types + writers |
| Drop `is_in_lead_inbox` | No | Prospect search index overlays |
| Drop `growth.lead_inbox` | No | FKs above |

Draft SQL: [`GE-LEADS-CANONICAL-4E_SCHEMA_DROP_DRAFT.sql`](./GE-LEADS-CANONICAL-4E_SCHEMA_DROP_DRAFT.sql)

## Recommended final drop plan

1. **4F code cutover** — Remove `lead_inbox_id` from intelligence repo writes/reads; key overlays by `growth_lead_id` only.
2. **4F signal + prospect-search** — Stop referencing `processed_to_lead_inbox`, `lead_inbox_id`, `is_in_lead_inbox`; migrate index to `growth_lead_id` flag if needed.
3. **Certify** — Run 4e cert + production read-only: inbox 0 rows, queue ≥ 23 cards, no lib runtime inbox queries.
4. **Apply migration** — Uncomment phases in draft SQL as single ordered migration `20270902120000_growth_engine_drop_legacy_lead_inbox_4f.sql`.
5. **Post-drop** — Rename adapter types (`LeadInbox` → `RevenueQueueCard`) in follow-up UX pass.
