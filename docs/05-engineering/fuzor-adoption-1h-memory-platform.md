# FUZOR-ADOPTION-1H — Memory Platform Delegation

**Milestone ID:** FUZOR-ADOPTION-1H  
**Status:** Complete (local adoption)  
**Effective:** 2026-07-22  
**Platform prerequisite:** Certified for Multi-Tenant Platform Operation (Hardening 1A)  
**Scope:** Delegate GE-AIOS-12A / 17B / 17C organizational memory and GE-AIOS-2F registry into `@fuzor/memory`

---

## Executive summary

| Item | Result |
|------|--------|
| Organizational memory authority | `@fuzor/memory` |
| Memory registry authority | `@fuzor/memory` |
| Equipify role | Compatibility consumer (thin wrappers) |
| Import paths | Unchanged |
| Tenant enforcement | Explicit `organizationId`; org-scoped storage |
| Schema / migrations | Unchanged — Equipify-owned |
| Production validation | **Not performed** — separate milestone |

**Constitutional split:** Platform answers *what has this organization learned?* Products answer *what should become memory?*

**Lifecycle:** **Extracted** · **Adopted** · **Validated (local)** — not Production Validated

---

## Phase 1 — Memory audit

### Delegated to `@fuzor/memory`

| Equipify module | Classification |
|-----------------|----------------|
| `lib/growth/memory/*` (except knowledge repository) | Engine, storage, synthesis, bridges |
| `lib/growth/aios/ai-memory-registry-*` | Registry types, repository, service |
| `lib/growth/aios/ai-memory-source-registry.ts` | Source bindings |
| `lib/growth/specialists/execution/sales-specialist-memory-bridge.ts` | Sales outcome bridge |

### Retained in Equipify

| Module | Reason |
|--------|--------|
| `lib/growth/memory/knowledge/organization-knowledge-repository.ts` | BI product coupling |
| `lib/growth/memory/knowledge/organization-knowledge-schema-health.ts` | Local schema probe |
| `lib/growth/lead-memory/*` | Lead-scoped human memory (distinct domain) |
| `lib/voice/relationship-memory/*` | Voice relationship domain |
| `growth-agent-memory-*` | Ephemeral AI OS read model |
| UX localStorage “memory” helpers | Browser product state |
| Outreach/reply memory utilization | Product consumers |

---

## Phase 2 — Ownership

### Fuzor owns

- Memory engine orchestration (`runPlatformMemoryEngine`)
- Event synthesis, patterns, timeline, summaries, preferences
- Organizational memory persistence (17B repository + localStorage store)
- Knowledge promotion builders (17C)
- Memory registry (2F) CRUD, lifecycle, audit trail
- Sales outcome → memory event bridge
- Institutional learning truthfulness filters
- Tenant-scoped storage keys and server queries

### Equipify owns

- When memory is created (workflow triggers)
- Ava decisions, campaigns, DataMoon
- Lead memory and voice relationship memory
- Operator UX and API routes
- Organization knowledge repository (BI hydration)
- Database migrations and RLS

---

## Phase 3 — Delegation

### Compatibility wrappers

All wrappers preserve Equipify export names (`runMemoryEngine`, `Ava*`, `GROWTH_*`) and delegate to `@fuzor/memory` platform exports.

`lib/growth/memory-org-bootstrap.ts` resolves server organization scope via existing `getGrowthEngineAiOrgId()` (mirrors knowledge 1E pattern).

### Package consumption

```json
"@fuzor/memory": "file:../../fuzor/packages/memory",
"@fuzor/event-bus": "file:../../fuzor/packages/event-bus",
"@fuzor/decision-records": "file:../../fuzor/packages/decision-records"
```

Registry service transitively uses `@fuzor/event-bus` and `@fuzor/decision-records`.

---

## Phase 4 — Tenant validation

| Surface | Enforcement |
|---------|-------------|
| Memory engine | Requires resolved `organizationId` (wrapper preserves client `local-organization` fallback for parity) |
| Server repository | `.eq("organization_id", input.organizationId)` |
| localStorage store | Key suffix `:organizationId`; rejects mismatched parsed org |
| Registry repository | All queries filtered by `organization_id` |
| No process-global tenant defaults | Confirmed |

---

## Phase 5 — Behavioral parity

Parity test: `pnpm test:fuzor-adoption-1h-memory-platform-parity`

- QA markers match platform exports
- Engine output deep-equal for explicit org fixture
- Wrapper source inspection confirms delegation
- Existing cert scripts: `test:ge-aios-12a`, `test:ge-aios-17b`, `test:ge-aios-17c`, `test:ge-aios-2f`

---

## Phase 6 — Compatibility

Stable import paths unchanged:

- `@/lib/growth/memory`
- `@/lib/growth/memory/storage/*`
- `@/lib/growth/aios/ai-memory-registry-*`

---

## Phase 7 — Future multi-product model

```
Equipify  → Organization A Memory
Insideify → Organization B Memory
```

Each product calls identical `@fuzor/memory` infrastructure with explicit per-organization scope. Memory content and workflow triggers remain product-owned.

---

## Phase 8 — Validation

| Check | Script |
|-------|--------|
| Platform memory unit tests | `@fuzor/memory` `pnpm test` |
| Adoption parity | `test:fuzor-adoption-1h-memory-platform-parity` |
| Memory engine cert | `test:ge-aios-12a-memory-engine` |
| Server org memory cert | `test:ge-aios-17b-server-organizational-memory` |
| Organizational knowledge cert | `test:ge-aios-17c-organizational-knowledge` |
| Registry cert | `test:ge-aios-2f-memory-registry-foundation` |

---

## Lifecycle

| Stage | Status |
|-------|--------|
| Extracted | Complete |
| Adopted | Complete |
| Validated (local) | Complete |
| Production validated | Not started |
