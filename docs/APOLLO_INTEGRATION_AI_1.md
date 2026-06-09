# Apollo Integration AI-1 — Provider Activation & Contact Acquisition Foundation

Phase **AI-1** activates Apollo as the primary external contact acquisition source within the existing Growth Engine discovery pipeline. No redesign of lead discovery, canonical companies/persons, or research systems.

## 1. Apollo Audit — Existing vs Missing

### Reusable (complete)

| Component | Path | Role |
|-----------|------|------|
| Apollo HTTP client | `lib/growth/providers/apollo/apollo-client.ts` | `mixed_people/api_search` + optional `bulk_match` |
| Config + diagnostics | `lib/growth/providers/apollo/apollo-config*.ts` | Env flags, `ready_for_live_*` gates |
| Contact mapper | `lib/growth/providers/apollo/map-apollo-contact.ts` | Identity gates, provenance metadata |
| Discovery provider | `lib/growth/contact-discovery/providers/apollo-contact-discovery-provider.ts` | Operator-chain integration |
| Acquisition adapter | `lib/growth/contact-discovery/providers/apollo-contact-acquisition-adapter.ts` | Phase 7.PCA-1 `vendor` + `buildDiagnostics` |
| Mock fixtures | `lib/growth/providers/apollo/apollo-mock-fixtures.ts` | CI / dev without credits |
| Run guardrails | `lib/growth/providers/apollo/apollo-run-guardrails.ts` | Per-run API + company caps |
| Pipeline orchestrator | `lib/growth/contact-discovery/contact-repository.ts` | Multi-provider discovery runs |
| Human acquisition | `lib/growth/prospect-search/prospect-search-human-acquisition.ts` | Discovery → sync → canonical backfill |
| Dedupe | `contact-normalizer.ts`, `website-contact-discovery.ts` | Candidate vs company-layer dedupe |
| Benchmark runner | `lib/growth/benchmark/growth-contact-acquisition-apollo-benchmark.ts` | End-to-end validation |
| Staging tables | `contact_candidates`, `contact_discovery_runs`, `company_contacts` | Provenance + canonical store |

Run programmatic audit:

```bash
pnpm test:apollo-integration-ai-1
```

### Partial

| Gap | Status |
|-----|--------|
| CSV import adapter | Column aliases only (`apollo-stub.ts`); not UI-enabled |
| Provider type naming | DB enum still `future_apollo` despite live provider |
| Person acquisition registry | Lists `apollo_api` as not wired (stale vs runtime) |

### Stub / deferred (intentional)

| Gap | Reason |
|-----|--------|
| Prospect search Apollo slot | Apollo is contact acquisition, not company search |
| External company discovery Apollo slot | Same — contacts only |
| Apollo query cache | Not implemented; repeat searches not cached |
| Lead Engine vendor bridge | Research uses internal snapshot; external routing deferred |

---

## 2. Activation Requirements

### Minimum (mock — no credits)

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=true
```

### Live people search (no enrichment credits by default)

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
APOLLO_API_KEY=...                    # or GROWTH_APOLLO_API_KEY
GROWTH_APOLLO_USE_MOCK=false
GROWTH_DISCOVERY_DISABLE_APOLLO=      # must NOT be 1
```

### Live benchmark / bulk runs

```bash
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
```

### Email enrichment (consumes credits)

```bash
GROWTH_APOLLO_ENRICH_EMAILS=true
GROWTH_APOLLO_ENRICH_EMAILS_ACK=1
```

### Safety caps (defaults)

| Variable | Default |
|----------|---------|
| `GROWTH_APOLLO_MAX_COMPANIES_PER_RUN` | 54 |
| `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN` | 60 |
| `GROWTH_APOLLO_MAX_CONTACTS_PER_COMPANY` | 25 |

### API endpoints

- Base: `https://api.apollo.io/api/v1`
- Search: `POST /mixed_people/api_search` (search-only, no credits by default)
- Enrich: `POST /people/bulk_match` (credit-consuming when enabled)

### Mock vs live

| Mode | Behavior |
|------|----------|
| `GROWTH_APOLLO_USE_MOCK=true` | Fixture people; no HTTP; mock wins even if API key set |
| Live + key | Real Apollo search |
| `GROWTH_DISCOVERY_DISABLE_APOLLO=1` | Hard kill — provider always skipped |

---

## 3. Data Flow — Apollo → Canonical → Research → Sequence

```text
Apollo Search (operator contact discovery)
    ↓
contact_candidates (provider=future_apollo, Apollo metadata preserved)
    ↓
normalize + dedupe (name+title at candidate layer)
    ↓
company_contacts (email-aware dedupe, canonical company match)
    ↓
canonical persons backfill
    ↓
company intelligence + buying committee discovery
    ↓
fit scoring (apollo source weight = 90) + relationship intelligence
    ↓
prospect search sequence readiness
    ↓
sequence enrollment → email / voice drop / SMS / call
```

### Import workflows supported

| Workflow | Mechanism |
|----------|-----------|
| Manual search | Operator triggers contact discovery on company candidate |
| Bulk import | `growth-contact-acquisition-apollo-benchmark` + guardrails |
| Company import | `runProspectSearchHumanAcquisitionPipeline` per company |
| Decision maker import | ICP title filters in `apollo-query-builder.ts` + decision-maker scoring |

Provenance: `external_provider_contact_id`, `apollo_person_id`, adapter metadata on `contact_candidates.metadata`.

Canonical companies and persons remain authoritative — Apollo never direct-writes `company_contacts`.

---

## 4. Cost Controls

| Control | Implementation |
|---------|----------------|
| Master enable | `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED` |
| Kill switch | `GROWTH_DISCOVERY_DISABLE_APOLLO=1` |
| Mock mode | `GROWTH_APOLLO_USE_MOCK=true` — zero HTTP |
| Live benchmark ACK | `GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1` |
| Enrichment ACK | `GROWTH_APOLLO_ENRICH_EMAILS_ACK=1` |
| Per-run company cap | `assertApolloCompanySearchAllowed` + env limit |
| Per-run API cap | 60 default; throws `ApolloRunGuardrailError` |
| Contacts per company | Capped at 25 |
| Candidate dedupe | Prevents duplicate staging rows |
| Company contact dedupe | Email-aware at sync layer |
| Identity filters | Generic titles / irrelevant ICP titles skipped |
| Provider write boundary | Providers return raw contacts only |

Credit visibility: `getApolloRunGuardrailSnapshot()` tracks `search_api_calls`, `bulk_match_batches`, `credits_estimate`.

---

## 5. Enrollment Readiness

Use `evaluateApolloImportReadiness()` from `lib/growth/apollo/apollo-import-readiness.ts`:

| Flag | Meaning |
|------|---------|
| `research_complete` | Research summary + contacts synced + canonical persons linked |
| `score_available` | Lead fit score present |
| `contactable` | Eligible email or phone channel |
| `sequence_ready` | Above + prospect search sequence readiness = ready |

Overall states: `imported` → `research_in_progress` → `research_complete` → `contactable` → `sequence_ready`

---

## 6. Certification

```bash
pnpm test:apollo-integration-ai-1
```

Validates: audit inventory, activation modes, mock discovery, dedupe, canonical eligibility, research pipeline wiring, scoring weight, readiness states, cost guardrails.

Report: [APOLLO_INTEGRATION_AI_1_CERTIFICATION_REPORT.md](./APOLLO_INTEGRATION_AI_1_CERTIFICATION_REPORT.md)

---

## 7. Remaining Gaps (before live Apollo at scale)

1. **Live certification** — Run one controlled company through mock-off pipeline with real API key
2. **Rename `future_apollo`** — DB enum + types (cosmetic, non-blocking)
3. **CSV import UI** — Enable Apollo vendor in import UI when ops-ready
4. **Query cache** — Optional Apollo search dedupe (like Places/SERP cache)
5. **Lead Engine bridge** — Wire Apollo snapshot into contact research prompts
6. **Voice Drop × Apollo** — Complete VD-4 live certification before sequence outreach at scale

**Readiness verdict:** **Ready for controlled live activation** (mock-off, single-company pilot). **Not ready for unattended bulk Apollo enrollment** until live pilot metrics and ACK gates are validated.
