# GE-AIOS-2F — Infrastructure Audit

**Phase:** GE-AIOS-2F — Memory Foundation  
**Date:** 2026-06-25

---

## Existing memory-like stores audited

| Store | Location | Registry binding |
|-------|----------|------------------|
| Lead memory profiles | `growth.lead_memory_profiles` | `lead` |
| Lead memory events | `growth.lead_memory_events` | Referenced via lead profiles |
| Relationship context | `growth.relationship_context` | `relationship` |
| Company intelligence | `growth.company_intelligence_snapshots` | `company` |
| Lead research runs | `growth.lead_research_runs` | `research` |
| Knowledge Center | `growth.signal_events` (ingested docs) | `playbook` |
| Provider query cache | `growth.provider_query_cache` | `provider` |
| AI Decision Records | `growth.ai_decision_records` | `decision` |
| Mission / objectives | `growth.organization_growth_objectives` | `organization`, `mission`, `strategy` |
| AI response cache | `public.ai_cache` | **Not registered** — deterministic cache, not constitutional memory |
| Inbox threads | `growth.inbox_threads` | `conversation` (canonical reference) |

---

## Reuse strategy

- **No payload duplication** — registry stores metadata + source pointers only
- **Deduplication** — unique index on `(organization_id, source_table, source_record_id)` prevents duplicate registry rows for the same source
- **Work Order integration** — appends to existing `memory_refs[]` on link (GE-AIOS-2A)
- **Decision Record integration** — audit events reference `decision_record_id` without copying decision payloads

---

## Explicitly not modified

- Lead memory engine write paths
- Knowledge Center ingestion/retrieval
- Company intelligence pipelines
- Learning loop / playbook outcome learning
- Equipify Core

---

## Not in scope (deferred)

- Vector search, embeddings, RAG
- Memory Retrieval Service consumption wiring
- Memory summarization cron (Constitution §15)
- Learning Engine writes
