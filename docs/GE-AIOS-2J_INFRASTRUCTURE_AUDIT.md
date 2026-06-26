# GE-AIOS-2J — Infrastructure Audit

**Phase:** GE-AIOS-2J — Context Assembly Foundation  
**Date:** 2026-06-25

---

## Existing systems audited

| System | Location | Relationship |
|--------|----------|--------------|
| Work Orders (2A) | `ai-work-order-repository.ts` | **Reused** — primary assembly anchor |
| Mission objectives | `growth-objective-repository.ts` | **Reused** — mission context section |
| Decision Records (2D) | `ai-decision-record-repository.ts` | **Reused** — decision history summaries |
| Memory Registry (2F) | `ai-memory-registry-repository.ts` | **Reused** — memory reference metadata |
| AI OS Events (2B) | `ai-event-service.ts` | **Reused** — related event summaries |
| Lead memory | `lead-memory/memory-influence-context.ts` | **Reused** — lead entity projection |
| Company intelligence | `company-intelligence-repository.ts` | **Reused** — company snapshot summaries |
| Decision Engine evidence | `ai-decision-engine-evidence-collector.ts` | **Reused** — evidence bundle builder |
| Memory source registry (2F) | `ai-memory-source-registry.ts` | **Extended** — context source catalog |

---

## Reuse strategy

Context Assembly is the **only** AI OS component allowed to gather from multiple subsystems. It:

1. Reads Work Order row (never writes)
2. Fetches mission from `organization_growth_objectives`
3. Summarizes linked Decision Records (IDs + key fields, not full duplication)
4. Resolves Memory Registry entries to source pointers
5. Queries related AI OS events by `workOrderId`
6. Projects entity intelligence read-only (lead memory, company snapshots)
7. Builds evidence bundle via existing deterministic collector
8. Computes SHA-256 checksum; persists immutable Context Package

Packages store **references and summaries** — not copies of source tables.

---

## Explicitly not in scope

- LLM or provider enrichment
- Work Order execution or Decision Record creation
- Executive Brain or Decision Engine wiring (future phases)
- Legacy playbook/outreach context builder replacement
- Equipify Core changes

---

## Checksum reuse

When `forceReassemble` is false and an existing package matches `workOrderId + contextVersion + checksum`, the bridge publishes `context.reused` without inserting a duplicate row.
