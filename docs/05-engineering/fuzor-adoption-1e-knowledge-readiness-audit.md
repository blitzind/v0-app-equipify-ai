# FUZOR-ADOPTION-1E-READINESS-AUDIT — Knowledge Center Delegation Design

**Milestone ID:** FUZOR-ADOPTION-1E-READINESS-AUDIT  
**Status:** Complete (read-only audit)  
**Effective:** 2026-07-22  
**Scope:** Implementation planning only — **no code changes**

---

## 1. Executive Recommendation

| Question | Answer |
|----------|--------|
| **Is Knowledge delegation ready to implement?** | **Yes, locally** — with a mandatory org-resolution adapter and atomic server-module cutover |
| **Recommended 1E scope** | **Scope D — Full GS-3 Knowledge Center delegation** (all modules under `lib/growth/knowledge-center/`) |
| **Must portability be solved first?** | **No for local implementation**; **Yes before production push or Vercel validation** |
| **Canonical Equipify wrapper boundary** | Retain **`lib/growth/knowledge-center/*`** paths; replace bodies with `@fuzor/knowledge` re-exports/wrappers |
| **Production validation required?** | **Yes** before claiming Adopted — GS-3A–3D `:production` scripts perform DB reads/writes |
| **May implementation proceed locally?** | **Yes**, after 1D is committed; use org bootstrap adapter from day one |

**Summary:** `@fuzor/knowledge` is a near line-for-line extraction of Equipify GS-3A–3D. Persistence (`growth.signal_events`), payload shapes, QA markers, ranking, citations, and audit events match. The only material runtime adapter gap is **organization default resolution** (Equipify reads `GROWTH_ENGINE_AI_ORG_ID` from `process.env`; Fuzor reads an injectable default). Schema-health probing is duplicated but semantically identical.

**Do not merge** Organizational Knowledge 17C, seller-truth composition, equipify-master-knowledge, or lead-research evidence into this delegation.

---

## 2. Knowledge-System Classification

| System | Location | Role | Part of 1E? |
|--------|----------|------|-------------|
| **GS-3 Knowledge Center** | `lib/growth/knowledge-center/*` | Ingest, persist, search, retrieve, context inject, recommendations, citations | **Yes — canonical delegation target** |
| **Organizational Knowledge 17C** | `lib/growth/memory/knowledge/*` | Derived org learning store (`growth.organization_knowledge`); BI/memory promotion | **No** — separate Memory facet; consumer of events/BI, not GS-3 |
| **Seller truth** | `lib/growth/aios/growth/growth-outreach-seller-truth*.ts` | Product composition layer; profile SoT + enrichments | **No** — remains product-owned; **consumes** `runKnowledgeRetrieval` |
| **Equipify master knowledge** | `lib/growth/business-profile/equipify-master-knowledge-*` | Canonical seller seed / MCD merge into business profile | **No** — product-owned; separate QA markers and production apply scripts |
| **Campaign / playbook knowledge** | `campaign-readiness-service.ts`, `conversational-playbook-*` | **Consumers** of GS-3 via `listKnowledgeDocuments` / retrieval | **No move** — behavior preserved via stable GS-3 wrapper |
| **Lead / prospect research evidence** | Various lead-research modules | Lead-owned evidence, workflows, snapshots | **No** — not stored in GS-3 `signal_events` document contract |

**Distinction (GS-3 vs 17C):**

| | GS-3 Knowledge Center | Organizational Knowledge 17C |
|--|----------------------|------------------------------|
| Storage | `growth.signal_events` (document payloads) | `growth.organization_knowledge` (rows) |
| QA marker | `growth-knowledge-center-gs3a-v1` | `ge-aios-17c-organizational-knowledge-v1` |
| Authority | Platform knowledge artifacts | Validated org learning conclusions |
| Fuzor package | `@fuzor/knowledge` | `@fuzor/memory` (future, separate milestone) |

---

## 3. Fuzor Package Audit

**Package:** `@fuzor/knowledge` (`packages/knowledge/`)  
**Phase marker:** `FUZOR_KNOWLEDGE_PHASE = "FUZOR-KNOWLEDGE-1D"`  
**Dependencies:** `@supabase/supabase-js` only — no `@fuzor/identity`, `@fuzor/event-bus`, `@fuzor/context`  
**Tests:** 4 vitest files (parity foundation, retrieval, context-injection, recommendations, schema-health)

### Public export groups

| Module | Exports | Classification |
|--------|---------|----------------|
| `document-types.ts` | Categories, statuses, ingestion/search types, QA markers | Pure contracts (client-safe) |
| `classification.ts` | `classifyPlatformKnowledgeDocument` | Pure deterministic |
| `ingestion-service.ts` | `ingestPlatformKnowledgeDocument` | Pure deterministic (no DB) |
| `search.ts` | `searchPlatformKnowledge` | Pure deterministic (in-memory) |
| `retrieval-types.ts` | Consumers, weights, scopes | Pure contracts |
| `retrieval-service.ts` | Scoring, `retrievePlatformKnowledge` | Pure deterministic |
| `consumer-adapters.ts` | Consumer-scoped retrieval | Pure deterministic |
| `context-injection.ts` | Context bundling | Pure deterministic |
| `consumer-wiring.ts` | Bucket helpers | Pure deterministic |
| `context-types.ts` | Context contracts, audit event name | Pure contracts |
| `recommendation-types.ts` | Recommendation/citation types | Pure contracts |
| `citation-builder.ts` | Citation construction | Pure deterministic |
| `recommendation-engine.ts` | Recommendation generation | Pure deterministic |
| `repository.ts` | CRUD + search/retrieval against Supabase | **Server service** |
| `context-service.ts` | `injectPlatformKnowledgeContext` + audit insert | **Server service** |
| `recommendation-service.ts` | `generatePlatformKnowledgeRecommendationsForRequest` | **Server service** |
| `schema-health.ts` | Probe `growth.signals`, memoized cache | **Server helper** |
| `org-resolver.ts` | Injectable default org ID | **Adoption hook** |
| `persistence-contract.ts` | Schema/table constants | Pure contracts |

### Persistence (Fuzor authority)

| Item | Value |
|------|-------|
| Schema | `growth` |
| Document store | `signal_events` (`event_type = "ingested"`) |
| Document QA marker | `growth-knowledge-center-gs3a-v1` |
| Context audit QA | `growth-knowledge-context-gs3c-v1` |
| Recommendation audit QA | `growth-knowledge-recommendations-gs3d-v1` |
| Schema readiness probe | `growth.signals` (migration `20270527120000_growth_engine_signal_foundation.sql`) |
| RPCs | **None** — direct PostgREST table access |
| `ai_os_events` | **Not used** |

### Organization resolution (Fuzor)

```typescript
// packages/knowledge/src/org-resolver.ts
setPlatformKnowledgeDefaultOrganizationId(orgId | null)
getGrowthEngineAiOrgId() → platformKnowledgeDefaultOrganizationId  // NOT process.env
resolvePlatformKnowledgeOrganizationId(explicit?, default?)
```

### Event behavior (Fuzor)

Knowledge **writes directly to `signal_events`** — no Event Bus port, no `ai_os_events`.

| Write path | event_type | Payload flags |
|------------|------------|---------------|
| `createKnowledgeDocument` | `ingested` | `knowledge_document: true`, document payload |
| `persistKnowledgeContextRetrievalAudit` | `ingested` | `knowledge_context_retrieved: true` |
| `persistKnowledgeRecommendationAudit` | `ingested` | `knowledge_recommendations_generated: true` |

### Client/server boundaries

| Finding | Detail |
|---------|--------|
| Server-only modules | `repository.ts`, `context-service.ts`, `recommendation-service.ts` (no `"server-only"` import in Fuzor — Equipify adds it) |
| Client-safe | Types, classification, ingestion, search, retrieval scoring, context/recommendation pure helpers |
| Root barrel | Re-exports server + pure modules — **client components must not import server functions** |
| Import-time side effects | None — no `process.env` at import time in Fuzor org-resolver |
| Service role | Required for repository writes (caller supplies `SupabaseClient`) |

### Recommended future import paths

| Consumer | Safe import |
|----------|-------------|
| Client UI (types/constants) | `@/lib/growth/knowledge-center/knowledge-document-types` (wrapper) or future `@fuzor/knowledge` types-only subpath |
| Server routes/services | `@/lib/growth/knowledge-center/knowledge-repository` (wrapper → Fuzor) |
| **Do not** | Import `@fuzor/knowledge` root from `"use client"` components |

**Subpath need (future packaging only):** Consider `@fuzor/knowledge/contracts` if root barrel causes client bundling of repository — not required if Equipify wrappers preserve current import graph.

---

## 4. Equipify Runtime Audit

### Canonical GS-3 module tree

`lib/growth/knowledge-center/` — **21 files**, mirrors Fuzor extraction:

| File | Role |
|------|------|
| `knowledge-document-types.ts` | Contracts + QA markers |
| `knowledge-classification.ts` | Classifier |
| `knowledge-ingestion-service.ts` | Normalization |
| `knowledge-search.ts` | In-memory search |
| `knowledge-retrieval-types.ts` | Consumer registry |
| `knowledge-retrieval-service.ts` | Relevance scoring |
| `knowledge-consumer-adapters.ts` | Consumer retrieval |
| `knowledge-context-types.ts` | Context contracts |
| `knowledge-context-injection.ts` | Context builder |
| `knowledge-consumer-wiring.ts` | Buckets |
| `knowledge-citation-builder.ts` | Citations |
| `knowledge-recommendation-types.ts` | Recommendation contracts |
| `knowledge-recommendation-engine.ts` | Recommendation logic |
| **`knowledge-repository.ts`** | **Canonical persistence + search/retrieval server API** |
| **`knowledge-context-service.ts`** | Context inject + audit |
| **`knowledge-recommendation-service.ts`** | Recommendations + audit |
| `knowledge-*-certification.ts` | Production/local cert helpers |
| `index.ts` | Client-safe barrel (no repository) |

### API routes (all import compatibility modules — not Fuzor directly)

| Route | Methods | Imports |
|-------|---------|---------|
| `app/api/platform/growth/knowledge/documents/route.ts` | GET/POST/PATCH | `knowledge-repository`, `knowledge-document-types` |
| `app/api/platform/growth/knowledge/search/route.ts` | POST | `knowledge-repository` |
| `app/api/platform/growth/knowledge/classify/route.ts` | POST | classification types |
| `app/api/platform/growth/knowledge/retrieve/route.ts` | POST | `knowledge-repository` |
| `app/api/platform/growth/knowledge/retrieve/execute/route.ts` | POST | certification path |
| `app/api/platform/growth/knowledge/context/route.ts` | POST | `knowledge-context-service` |
| `app/api/platform/growth/knowledge/context/execute/route.ts` | POST | certification |
| `app/api/platform/growth/knowledge/recommendations/route.ts` | POST | `knowledge-recommendation-service` |
| `app/api/platform/growth/knowledge/recommendations/generate/route.ts` | POST | same |
| `app/api/platform/growth/knowledge/recommendations/execute/route.ts` | POST | certification |
| `app/api/platform/growth/knowledge/execute/route.ts` | POST | orchestration |

Auth: `requireGrowthEnginePlatformAccess()` → service-role `admin` client.

### Server service consumers (non-route)

| Consumer | Import | Read/Write | Org source |
|----------|--------|------------|------------|
| `growth-outreach-seller-truth-loader.ts` | `runKnowledgeRetrieval` | Read | Explicit `input.organizationId` |
| `campaign-readiness-service.ts` | `listKnowledgeDocuments` | Read | From campaign context |
| `conversational-playbook-service.ts` | `listKnowledgeDocuments` | Read | Explicit |
| Certification modules | repository + services | Write (tests) | Test org UUID |

### UI consumers

| Component | Imports | Client-safe |
|-----------|---------|-------------|
| `growth-knowledge-context-section.tsx` | types, context types | Yes — calls API routes |
| `growth-knowledge-recommendations-section.tsx` | recommendation types | Yes |
| `growth-knowledge-center-dashboard.tsx` | types + API | Yes |
| `growth-meeting-prep-panel.tsx`, etc. | context/recommendation sections | Yes |

**No UI component imports `knowledge-repository` directly.**

### Context / Memory consumers

GS-3 Knowledge Center is **not** wired into `@fuzor/context` assembly today (per adoption plan). Organizational knowledge (17C) feeds Home/autonomy separately.

---

## 5. Persistence Compatibility

| Aspect | Equipify (current) | Fuzor `@fuzor/knowledge` | Match? |
|--------|-------------------|--------------------------|--------|
| Schema | `growth` | `growth` | ✓ |
| Document table | `signal_events` | `signal_events` | ✓ |
| Foundation probe table | `signals` | `signals` | ✓ |
| Document `event_type` | `ingested` | `ingested` | ✓ |
| Payload `qa_marker` | `growth-knowledge-center-gs3a-v1` | Same | ✓ |
| Payload `knowledge_document` | `true` | `true` | ✓ |
| Document identity | `knowledge_document_id` UUID in payload | Same | ✓ |
| Update semantics | UPDATE `signal_events` by `audit_event_id` | Same | ✓ |
| List query | `.contains("event_payload", { qa_marker, knowledge_document })` | Same | ✓ |
| Org filter | Post-filter on `document.organization_id` | Same | ✓ |
| Limit | 500 default | 500 default | ✓ |
| RLS | Service-role bypass (Growth access) | Caller-supplied admin client | ✓ (same caller) |
| RPCs | None | None | ✓ |
| Separate chunks table | **No** — document embedded in event payload | Same | ✓ |
| Vector index | **No** | **No** | ✓ |

### Write behavior

| Operation | Deduplication | Idempotency | Transaction |
|-----------|---------------|-------------|-------------|
| Create | New UUID per insert | **Not idempotent** — each call inserts new row | Single insert |
| Update | Overwrites payload on existing audit row | Idempotent on same doc ID | Single update |
| Archive | Status → `archived` via update | Same | Single update |
| Context/recommendation audit | New insert each call | Append-only audit | Single insert |

**Migration required:** **No** — Fuzor uses identical contract.

### Schema-health divergence (non-blocking)

| | Equipify | Fuzor |
|--|----------|-------|
| Module | `lib/growth/signals/signal-schema-health.ts` | `packages/knowledge/src/schema-health.ts` |
| Probe | `growth.signals` SELECT limit 1 | Same |
| Cache | Separate memoization maps | Separate memoization maps |

**Risk:** Dual probe caches — behaviorally equivalent, not split-brain for data.

---

## 6. Organization Resolution

| Semantics | Equipify | Fuzor |
|-----------|----------|-------|
| Default org when omitted | `getGrowthEngineAiOrgId()` from `lib/growth/growth-engine-session.ts` | `getGrowthEngineAiOrgId()` from `org-resolver.ts` |
| Env var | `GROWTH_ENGINE_AI_ORG_ID` read at **call time** | **Not read** — uses `setPlatformKnowledgeDefaultOrganizationId()` |
| UUID validation | Zod UUID parse | None in resolver (callers must validate) |
| Explicit `organization_id` on request | Preferred; overrides default | Same |
| Missing org | `{ ok: false, error: "organization_id_required" }` on server paths | Same |

### Recommended wrapper strategy: **Option A — Preserve Fuzor injected resolver with Equipify bootstrap**

Implement in a single server-only bootstrap module (e.g. `lib/growth/knowledge-center/knowledge-fuzor-bootstrap.ts`):

```typescript
import { setPlatformKnowledgeDefaultOrganizationId } from "@fuzor/knowledge"
import { getGrowthEngineAiOrgId } from "@/lib/growth/growth-engine-session"

export function syncPlatformKnowledgeOrganizationDefault(): void {
  setPlatformKnowledgeDefaultOrganizationId(getGrowthEngineAiOrgId())
}
```

Call `syncPlatformKnowledgeOrganizationDefault()` at the top of each server entry point **or** once per request in repository wrapper before delegating.

**Do not adopt Option C (Fuzor Identity)** — no org resolution in Identity package today; would expand scope.

**Blocker if skipped:** Routes that omit `organization_id` and rely on env default would return `organization_id_required` under Fuzor without bootstrap.

---

## 7. Signal Event Compatibility

| Question | Answer |
|----------|--------|
| Current event authority | **`growth.signal_events`** — not `ai_os_events` |
| Fuzor behavior | Direct Supabase inserts (same table/shape) |
| Event Bus | **Not used** by GS-3 |
| Publication port | **None** — inline repository inserts |
| Dedup | Document ID UUID for content; audit events are append-only |
| Adapter required | **Org bootstrap only** — not event adapter |

### Event types written

| QA marker | event_name (payload) | Purpose |
|-----------|---------------------|---------|
| `growth-knowledge-center-gs3a-v1` | — | Document ingest |
| `growth-knowledge-context-gs3c-v1` | `knowledge_context_retrieved` | Context audit |
| `growth-knowledge-recommendations-gs3d-v1` | `knowledge_recommendations_generated` | Recommendation audit |

**Do not redirect to `@fuzor/event-bus` during adoption.**

---

## 8. Behavioral Parity

Side-by-side review of Equipify `knowledge-repository.ts` vs Fuzor `repository.ts` shows **identical logic** except import paths for org resolver and schema-health.

| Area | Parity | Notes |
|------|--------|-------|
| **Ingestion** | ✓ Identical | Same classification, normalization, timestamps |
| **Source ID** | ✓ | `randomUUID()` per create |
| **Deduplication** | ✓ | None on create (by design) |
| **Chunking** | ✓ | Full document in payload — no separate chunks |
| **Search** | ✓ | Token scoring, deterministic sort |
| **Retrieval** | ✓ | Consumer defaults, active-only filter, relevance weights |
| **Recommendations** | ✓ | Citation-required, consumer-specific types |
| **Citations** | ✓ | `document_id`, title, category |
| **Ordering** | ✓ | Score desc, then `updated_at` desc |
| **Errors** | ✓ | `schema_not_ready`, `organization_id_required`, `not_found` |
| **Degraded** | ✓ | Empty list when schema not ready |

### Differences (compatibility-adapter safe)

| Difference | Classification | Mitigation |
|------------|----------------|------------|
| Org default via env vs injectable | Compatibility-adapter safe | Bootstrap sync (§6) |
| Schema-health module location | Compatibility-adapter safe | Keep Equipify probe in cert scripts OR delegate with shared table |
| Fuzor lacks `"server-only"` import | Packaging-only | Retain `"server-only"` in Equipify wrapper files |
| Equipify `index.ts` omits repository | Intentional | Do not export repository from client barrel |

**No adoption blockers identified in core GS-3 semantics.**

---

## 9. Wrapper Design

### Strategy: module-preserving delegation (same pattern as 1B–1D)

Replace implementation bodies in existing Equipify files; **do not** introduce parallel `knowledge-fuzor-*` public paths.

### Proposed wrapper files

| Equipify file | Fuzor authority | Wrapper pattern |
|---------------|-----------------|-----------------|
| `knowledge-document-types.ts` | Re-export types/constants with Growth names | Type aliases / const aliases |
| `knowledge-classification.ts` | `classifyPlatformKnowledgeDocument` | `export const classifyKnowledgeDocument = classifyPlatformKnowledgeDocument` |
| `knowledge-ingestion-service.ts` | `ingestPlatformKnowledgeDocument` | Alias |
| `knowledge-search.ts` | `searchPlatformKnowledge` | Alias |
| `knowledge-retrieval-types.ts` | `PLATFORM_KNOWLEDGE_*` | Alias |
| `knowledge-retrieval-service.ts` | retrieval exports | Alias/wrapper |
| `knowledge-consumer-adapters.ts` | consumer adapter exports | Alias |
| `knowledge-context-types.ts` | context types | Alias |
| `knowledge-context-injection.ts` | context injection | Alias |
| `knowledge-consumer-wiring.ts` | wiring helpers | Alias |
| `knowledge-recommendation-types.ts` | recommendation types | Alias |
| `knowledge-citation-builder.ts` | citation builder | Alias |
| `knowledge-recommendation-engine.ts` | engine | Alias |
| **`knowledge-repository.ts`** | repository exports | Wrapper + org bootstrap before delegate |
| **`knowledge-context-service.ts`** | context service | Wrapper + `"server-only"` + bootstrap |
| **`knowledge-recommendation-service.ts`** | recommendation service | Wrapper + bootstrap |
| **New (internal):** `knowledge-org-bootstrap.ts` | `setPlatformKnowledgeDefaultOrganizationId` | Server-only; not public API |

### Preserved public exports (examples)

- `createKnowledgeDocument`, `listKnowledgeDocuments`, `runKnowledgeRetrieval`
- `injectKnowledgeContext`, `generateKnowledgeRecommendationsForRequest`
- All GS-3 QA markers unchanged

### Certification modules

Keep `knowledge-*-certification.ts` in Equipify — they call public compatibility exports (correct for prod validation).

---

## 10. Split-Brain Analysis

| Risk | Can it happen today? | Prevention in 1E |
|------|---------------------|-------------------|
| Equipify + Fuzor both ingest | Yes if partial delegation | **Atomic cutover** of entire `knowledge-center` server stack |
| Dual chunk stores | No — single `signal_events` | Same table; one repository authority |
| Dual signal publishers | Yes if mixed services | All writes through delegated repository/context/recommendation services |
| API uses Fuzor, cert uses embedded | Yes during partial migration | Single implementation behind compatibility paths |
| Direct repository bypass | **Yes** — consumers import `knowledge-repository` directly | Delegation in repository file covers all callers |
| Cron bypass | **No cron jobs** import knowledge-center found | N/A |
| Tests use `ingestKnowledgeDocument` without persist | Local tests only | Pure module delegation keeps same in-memory behavior |
| Org knowledge 17C vs GS-3 | Parallel systems by design | Document separation; no merge |

**Mandatory rule:** After 1E, **zero** retained duplicate implementations in `knowledge-center/` except thin wrappers and certification orchestration.

---

## 11. Server and Client Boundaries

| Layer | Rule |
|-------|------|
| Client components | Import only from `knowledge-document-types`, `knowledge-retrieval-types`, `knowledge-context-types`, `knowledge-recommendation-types`, or `index.ts` |
| Server routes | Import repository/services from compatibility paths |
| `"server-only"` | Keep on Equipify wrapper server modules |
| Root `@fuzor/knowledge` | Safe for server; **unsafe** for client if bundler pulls repository |
| Env reads | Only via org bootstrap (call time), not import time |
| Service role | Supplied by Growth access layer — unchanged |

**Tracked-import rules:** No change required if wrapper paths unchanged.

---

## 12. Certification Mapping

| Script | Phase | Local/Prod | Writes? | Tables | Org | Sufficient for 1E? |
|--------|-------|------------|---------|--------|-----|-------------------|
| `pnpm test:knowledge-center-foundation` | GS-3A | Both (`:production`) | Prod: yes (create) | `signal_events` | Test UUID / prod org | **Required** |
| `pnpm test:knowledge-retrieval-layer` | GS-3B | Both | Prod: optional read | `signal_events` | Fixed test UUID | **Required** |
| `pnpm test:knowledge-context-injection` | GS-3C | Both | Prod: audit insert | `signal_events` | Test UUID | **Required** |
| `pnpm test:knowledge-recommendations` | GS-3D | Both | Prod: audit insert | `signal_events` | Test UUID | **Required** |
| `pnpm test:ge-aios-17c-organizational-knowledge` | 17C | Local | Yes (17C table) | `organization_knowledge` | Mock | **Out of scope** |
| `pnpm test:ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring` | Playbook | Local | No | — | — | Regression (consumer) |
| `pnpm test:ge-aios-equipify-master-knowledge-1a` | Master knowledge | Local | No | — | — | **Out of scope** |

### Production script notes (inspected, not run)

- Use `vercel-production-env-run.ts` — **not** `.env.local`
- GS-3A prod may create real documents — requires controlled org + cleanup policy
- All prod variants gated by confirm tokens / QA markers

### Gaps for 1E implementation

| Gap | Required addition |
|-----|-----------------|
| Fuzor delegation parity | `pnpm test:fuzor-adoption-1e-knowledge-service-parity` (fixture + optional DB mock) |
| Org bootstrap | Test that env default resolves after `syncPlatformKnowledgeOrganizationDefault()` |
| Wrapper reference | Verify Equipify exports === Fuzor exports after delegation |
| 1B/1C regression | Re-run identity + observability adoption tests |

---

## 13. Recommended 1E Scope

**Recommendation: Scope D — Full GS-3 Knowledge Center delegation**

| Scope | Fit |
|-------|-----|
| A — Contracts only | Too narrow — repository already extracted; would leave dual server authority |
| B — Read only | **Unsafe** — same repository module handles read+write; splitting creates split-brain |
| C — Ingest + read | Incomplete — context/recommendation audits also write `signal_events` |
| **D — Full GS-3** | **Correct** — single runtime authority, one persistence writer, all consumers unchanged |

**Why not smaller scope:** Reads and writes share `knowledge-repository.ts`. Partial delegation would leave competing implementations for the same `signal_events` contract.

---

## 14. Portability Recommendation

**Recommendation: Option 1 — Implement locally now; Option 2 before production push**

| Factor | Assessment |
|--------|------------|
| Local validation value | **High** — GS-3A–3D local scripts need no production |
| New dependency | `@fuzor/knowledge` (4th sibling `file:` dep) |
| Packaging changes | Likely `default` export + possible `./contracts` subpath |
| Unpushable milestone stack | 1A–1D already local-only; 1E continues pattern |
| Fuzor not in git | Separate future init; does not block local work |
| Production validation | Blocked until **FUZOR-DISTRIBUTION-1A** or submodule strategy |

**Prerequisite for Vercel/production:** `FUZOR-DISTRIBUTION-1A — Production-Portable Package Source` (submodule, registry, or vendored tarball).

Local 1E implementation **may proceed** without distribution fix; **must not claim production-validated Adopted**.

---

## 15. Future Validation Plan

### Level 1 — Static

```bash
cd /Users/blitz/Projects/fuzor
npm run build --workspace=@fuzor/knowledge
npm test

cd /Users/blitz/Projects/equipify/equipify-app
pnpm install
pnpm check:tracked-imports
pnpm exec next build  # dummy NEXT_PUBLIC_* env; compile-only
```

### Level 2 — Wrapper parity (new)

`pnpm test:fuzor-adoption-1e-knowledge-service-parity`

- Pure module fixture parity (ingest, search, retrieve, citations)
- Org bootstrap parity
- QA marker identity

### Level 3 — Equipify integration

```bash
pnpm test:knowledge-center-foundation
pnpm test:knowledge-retrieval-layer
pnpm test:knowledge-context-injection
pnpm test:knowledge-recommendations
pnpm test:fuzor-adoption-1b-identity-actor-catalog
pnpm test:fuzor-adoption-1c-observability-helper-parity
pnpm test:ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring
```

### Level 4 — Production-safe reads (explicit authorization only)

```bash
pnpm test:knowledge-retrieval-layer:production
pnpm test:knowledge-context-injection:production  # audit writes — treat as controlled
```

Read-only prod: prefer retrieval list/search against known org — **no `.env.local`**.

### Level 5 — Controlled production write (optional, separate approval)

`pnpm test:knowledge-center-foundation:production` — idempotent test org, document cleanup plan.

### Level 6 — Retirement

Separate milestone after production validation window — remove embedded duplicate **only after** delegation proven in production.

---

## 16. Rollback Plan

### Code rollback (no migration)

1. Restore pre-1E bodies in all `lib/growth/knowledge-center/*` wrapper files
2. Remove `@fuzor/knowledge` from `package.json` + lockfile
3. Remove org bootstrap module and 1E parity test
4. Revert Fuzor packaging changes if any
5. Run GS-3A–3D local scripts + compile validation

### Package rollback

Pin previous Equipify commit; rebuild Fuzor `dist/` if needed.

### Runtime rollback

- Ensure **only** embedded repository path active (no mixed imports from `@fuzor/knowledge`)
- No data transformation required — persistence unchanged
- Existing `signal_events` rows remain valid

**Rollback blocker if:** Dual writers ran concurrently in production — **prevent by atomic cutover, not gradual route-by-route migration.**

---

## 17. Risks and Blockers

| Risk | Severity | Mitigation |
|------|----------|------------|
| Org default not bootstrapped | **High** | Mandatory bootstrap in server wrappers |
| Partial module delegation | **High** | Scope D atomic cutover |
| Client imports Fuzor root | Medium | Keep client imports on Equipify type modules |
| Production cert writes | Medium | Level 5 gated; separate approval |
| Package portability | Medium | FUZOR-DISTRIBUTION-1A before push |
| 17C confusion | Low | Document separation (this audit) |
| Schema probe dual cache | Low | Accept or unify probe import later |
| Active 1D working tree | Low | Commit 1D before starting 1E implementation |

**No persistence contract blockers identified.**

---

## 18. Proposed Implementation Milestones

| Milestone | Content |
|-----------|---------|
| **FUZOR-DISTRIBUTION-1A** | Submodule/registry — **before production push** |
| **FUZOR-ADOPTION-1E-1** | Wire `@fuzor/knowledge`; org bootstrap; pure module delegation; parity test |
| **FUZOR-ADOPTION-1E-2** | Delegate repository + context + recommendation services; `"server-only"` wrappers |
| **FUZOR-ADOPTION-1E-3** | Run GS-3A–3D local + compile; fix certification file-existence checks if needed |
| **FUZOR-ADOPTION-1E-4** | Production validation (read-first, then controlled write) — **separate authorized prompt** |

Splitting 1E-1/1E-2 is **organizational only** — ship in one PR batch to avoid split-brain.

---

## 19. Inventory Recommendation

| Capability | Recommended status |
|------------|-------------------|
| `@fuzor/knowledge` | Extracted |
| Equipify Knowledge adoption | Planned |
| Production validation | Planned |
| Embedded Equipify Knowledge | Not Retired |
| Organizational Knowledge 17C | Planned (Memory milestone) |
| Seller truth / master knowledge | Product-owned |

---

## 20. Final Confirmation

| Requirement | Status |
|-------------|--------|
| No runtime source modified | ✓ Audit only |
| No dependencies added | ✓ |
| No imports changed | ✓ |
| No migrations | ✓ |
| No persistence changes | ✓ |
| No environment changes | ✓ |
| No `.env.local` | ✓ |
| No production scripts run | ✓ |
| No production writes | ✓ |
| No deployment / commit / push | ✓ |
| GS-3 vs 17C not merged | ✓ Documented |
| Scope evidence-based | ✓ Scope D with org adapter |
| Blockers explicit | ✓ Portability + org bootstrap + atomic cutover |

---

## Working-Tree Audit (Equipify)

```
 M lib/growth/aios/learning/growth-adaptive-calibration-config-registry.ts
 M lib/growth/aios/learning/growth-adaptive-calibration-config-resolver.ts
 M lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts
 M lib/growth/runtime/growth-feature-registry.ts
 M package.json
 M pnpm-lock.yaml
 M scripts/test-growth-runtime-guardrails.ts
?? docs/05-engineering/fuzor-adoption-1d-configuration-constants.md
?? scripts/test-fuzor-adoption-1d-configuration-constant-parity.ts
```

| Milestone | Commit status |
|-----------|---------------|
| 1A–1C (`@fuzor/identity`, `@fuzor/observability`, delegation files) | **Present on HEAD** (in `package.json` and source) |
| 1D (`@fuzor/configuration`) | **Uncommitted** |
| Unrelated probe | `scripts/_probe-post-deploy-research-stall-1a-readonly.ts` — not in current status |

**Recommendation:** Commit 1D locally before beginning 1E implementation.

---

## Appendix — Implementation Prompt Seed (for FUZOR-ADOPTION-1E)

When implementing, the prompt must require:

1. Add `"@fuzor/knowledge": "file:../../fuzor/packages/knowledge"`
2. Create `knowledge-org-bootstrap.ts` syncing `getGrowthEngineAiOrgId()` → `setPlatformKnowledgeDefaultOrganizationId()`
3. Delegate all 15 implementation modules under `lib/growth/knowledge-center/` (keep certification files calling compatibility exports)
4. Preserve all Growth-prefixed export names and QA markers
5. Scope D atomic cutover — no partial repository delegation
6. New parity test + GS-3A–3D regression
7. Do not touch 17C, seller-truth, master-knowledge, API route handlers (except if import paths break — should not)
8. No `.env.local`; compile-only Next.js validation
9. Document in `fuzor-adoption-1e-knowledge-service-delegation.md`
