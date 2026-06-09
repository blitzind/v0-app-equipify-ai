# Apollo EN-1 — Contact Channel Enrichment Certification

## Context

Henry Schein live pilot (search-only) proved Apollo returns and maps people, but all 10 rows are channel-less (name + title only). Classification: `apollo_results_missing_contact_channels`. Sequence-ready: 0.

This document certifies the safest path to obtain usable contact channels without outreach, enrollment, or ungated bulk enrichment.

## Existing Enrichment Audit

| Path | Works on search-only Apollo rows? | Role | Credit cost |
|------|-----------------------------------|------|-------------|
| **Apollo `people/bulk_match`** | **Yes** — requires `apollo_person_id` | Post-search email/phone/LinkedIn reveal | ~1 credit per 10 IDs |
| ZeroBounce | No | Verifies existing emails only | Per validation |
| PDL person search | No | Parallel discovery by company | PDL API credits |
| Website discovery | No | Crawls public pages; no Apollo ID link | Compute only |
| Internal email discovery | No | Pattern inference for canonical persons | ZeroBounce on promote |
| Internal phone discovery | No | Phone inference from stored evidence | Provider-dependent |
| Internal growth enrichment | No | Reads stored candidate fields | None |

Implementation references: `lib/growth/apollo/apollo-enrichment-cert-audit.ts`

## Recommended Path

**Apollo `people/bulk_match`** via `enrichApolloPeopleWithBulkMatch()` (`lib/growth/providers/apollo/apollo-enrich-people.ts`).

Why:

1. Uses existing `apollo_person_id` from search-only mapper output.
2. Same provider identity — no cross-provider reconciliation.
3. Credit guardrails already exist (`apollo-run-guardrails.ts`).
4. Live pilot intentionally keeps enrichment off; EN-1 cert is a separate gated step.

Post-enrichment: optional ZeroBounce verification on revealed emails (does not discover channels).

## Credit Safety Gates

### Required env (all must be set for live enrichment)

| Variable | Value | Purpose |
|----------|-------|---------|
| `GROWTH_APOLLO_EN_1_CERT_ENABLED` | `true` | Master switch for EN-1 cert runner |
| `GROWTH_APOLLO_EN_1_CERT_ACK` | `1` | Explicit operator acknowledgment |
| `GROWTH_APOLLO_ENRICH_EMAILS` | `true` | Enables bulk_match |
| `GROWTH_APOLLO_ENRICH_EMAILS_ACK` | `1` | Explicit credit-spend acknowledgment |
| `GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID` | UUID | Exactly one company |
| `GROWTH_APOLLO_EN_1_MAX_PEOPLE` | ≤10 (default 10) | Hard cap on people enriched |

### Hard limits

- Max **1 company** per cert run.
- Max **10 people** per cert run (`APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE`).
- `recordApolloBulkMatchBatch()` throws if bulk_match runs without `GROWTH_APOLLO_ENRICH_EMAILS=true`.
- Live pilot remains search-only (`GROWTH_APOLLO_ENRICH_EMAILS=false` recommended for AI-3 pilot).

## One-Company Enrichment Test

### EN-2 — Production runtime (recommended)

Uses Vercel Production secrets only — no local `APOLLO_API_KEY`, no `.env.local`.

**Vercel Production env (required):**

| Variable | Value |
|----------|-------|
| `GROWTH_APOLLO_EN_1_CERT_ENABLED` | `true` |
| `GROWTH_APOLLO_EN_1_CERT_ACK` | `1` |
| `GROWTH_APOLLO_ENRICH_EMAILS` | `true` |
| `GROWTH_APOLLO_ENRICH_EMAILS_ACK` | `1` |
| `GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID` | Henry Schein UUID (or `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID`) |
| `GROWTH_APOLLO_USE_MOCK` | `false` |

1. **Readiness:** `GET /api/platform/growth/apollo-enrichment-cert/readiness` (platform admin session)
2. **Execute:** `POST /api/platform/growth/apollo-enrichment-cert/execute` with body `{ "confirm": "RUN_APOLLO_ENRICHMENT_CERT" }`

Tests: `pnpm test:apollo-enrichment-cert-production-route`

### EN-1 — Local CLI (requires exported secrets)

```bash
# 1. Run search-only live pilot first (Henry Schein)
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true \
GROWTH_APOLLO_ENRICH_EMAILS=false \
pnpm run:apollo-live-pilot  # or production execute route

# 2. Run EN-1 enrichment cert (live — consumes credits)
GROWTH_APOLLO_EN_1_CERT_ENABLED=true \
GROWTH_APOLLO_EN_1_CERT_ACK=1 \
GROWTH_APOLLO_ENRICH_EMAILS=true \
GROWTH_APOLLO_ENRICH_EMAILS_ACK=1 \
GROWTH_APOLLO_USE_MOCK=false \
GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID=<henry-schein-candidate-id> \
pnpm run:apollo-enrichment-cert-en-1
```

Unit tests (no credits):

```bash
pnpm test:apollo-enrichment-cert-en-1
```

## Evidence Tracked

| Metric | Field |
|--------|-------|
| Credits consumed | `enrichment.credits_consumed` |
| Emails found | `channels.emails_found` |
| Phones found | `channels.phones_found` |
| LinkedIn found | `channels.linkedin_found` |
| Verified emails | `channels.verified_emails` |
| Promoted company contacts | `promotion.company_contacts_synced` |
| Enriched with email / LinkedIn | `promotion.enriched_candidates_with_email` / `enriched_candidates_with_linkedin` |
| Promotion blockers | `promotion.promotion_blockers` |
| Contactable after promotion | `promotion.contactable_after_promotion` |
| Sequence-ready after promotion | `promotion.sequence_ready_after_promotion` |
| Sequence-ready contacts | `readiness.sequence_ready` |

### EN-3 — Post-enrichment promotion (Henry Schein)

After EN-2 bulk_match enriches `contact_candidates`, EN-3 promotes channel-bearing rows to `company_contacts`, runs canonical person backfill, and reports readiness without outreach or enrollment.

Tests: `pnpm test:apollo-enrichment-cert-en-3`

Implementation: `lib/growth/apollo/apollo-enrichment-cert-promotion.ts`

| EN-2 symptom | EN-3 fix |
|--------------|----------|
| `company_contacts_synced: 0` with channels in candidates | Resolve canonical company via staging linkage + domain fallback; reload enriched rows from DB before sync |
| `sequence_ready: 0` after sync | Run `runCanonicalPersonBackfillForCompanyCandidate` after promotion; gate sequence-ready on contactable email/phone + canonical person + identity classification |

## Go / No-Go Criteria

| Decision | Condition |
|----------|-----------|
| **go** | bulk_match reveals ≥1 new email, phone, or LinkedIn; no runtime errors |
| **conditional** | Credits spent but Apollo holds no channels for these rows; or mock run |
| **no_go** | No `apollo_person_id` on candidates, runtime errors, or gates failed |

Evaluator: `certifyApolloEnrichmentGoNoGo()` in `apollo-enrichment-cert-evidence-types.ts`

## Certification Result (Expected for Henry Schein)

After search-only pilot + EN-1 live cert:

- **If Apollo has emails**: `go` — channels obtained, candidates updated, company_contacts synced.
- **If Apollo search-only rows have no stored email/phone**: `conditional` — credits may be spent with zero yield; consider website discovery or manual review (out of EN-1 scope).

## Out of Scope (by design)

- Outreach / sequence enrollment
- Bulk multi-company enrichment
- PDL parallel discovery
- Modifying Apollo search or mapper logic
