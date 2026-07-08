# GE-LEADS-CANONICAL-4F — Legacy Lead Inbox Schema Drop (APPLIED)

**Status:** Applied to production via `20270936120000_growth_engine_drop_legacy_lead_inbox_4f.sql`  
**Production:** `growth.lead_inbox` dropped; Revenue Queue = 23 canonical cards from `growth.leads`

## Dropped schema

| Object | Action |
|---|---|
| `growth.lead_inbox` | Table dropped |
| `search_intent_signals.lead_inbox_id` | Column + FK dropped |
| `buying_stage_assessments.lead_inbox_id` | Column + FK dropped |
| `company_identification_matches.lead_inbox_id` | Column + FK dropped |
| `signals.processed_to_lead_inbox` | Column dropped |
| `signals.lead_inbox_id` | Column dropped |
| `prospect_search_index.is_in_lead_inbox` | Column dropped; index recreated without flag |
| `prospect_search_index.source_type` | Check constraint updated — `lead_inbox` source retired |

## Code changes (summary)

- Intelligence repos read/write **`growth_lead_id` only**
- Signal repos no longer select/map legacy inbox columns
- Prospect Search derives **`in_lead_inbox`** from `growth_lead_id` (TS adapter field; not a DB column)
- Cert scripts verify table/column absence instead of row counts

## Remaining naming cleanup (non-blocking)

- `GrowthLeadInboxRow`, `loadSearchIntentSignalsForLeadInbox`, API path `/api/platform/growth/lead-inbox`
- `in_lead_inbox` TS boolean (alias for Revenue Queue membership)
- Historical migration files referencing `growth.lead_inbox`

Cert: `scripts/certify-ge-leads-canonical-schema-drop-4f.ts`
