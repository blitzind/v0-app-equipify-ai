# Apollo Integration AI-2 — Live Pilot & Data Quality Certification

Phase **AI-2** validates real-world Apollo data quality, canonical matching, research enrichment, and sequence readiness before larger-scale imports. No new Apollo features.

## Prerequisites

Complete [APOLLO_INTEGRATION_AI_1.md](./APOLLO_INTEGRATION_AI_1.md) and ensure:

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
APOLLO_API_KEY=...
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_DISCOVERY_DISABLE_APOLLO=   # not 1
```

## Live pilot execution

See [APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md](./APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md).

```bash
GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED=true
GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID=<single-test-company-uuid>
GROWTH_APOLLO_AI_2_OUTPUT_PATH=./evidence/apollo-ai-2-pilot.json
pnpm run:apollo-live-pilot-ai-2
```

Validate captured evidence:

```bash
APOLLO_AI_2_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-2-pilot.json pnpm test:apollo-integration-ai-2
```

## Deliverables map

| # | Deliverable | Source |
|---|-------------|--------|
| 1 | Pilot results | `evidence` object from pilot runner |
| 2 | Data quality | `analysis.contact_quality` |
| 3 | Canonical matching | `analysis.canonical_matching` |
| 4 | Readiness funnel | `analysis.readiness_funnel` + fallout |
| 5 | Cost analysis | `analysis.cost_per_company` + `cost_projections` |
| 6 | Operating limits | `analysis.operating_limits` |
| 7 | Certification | `pnpm test:apollo-integration-ai-2` |
| 8 | Go/No-Go | `analysis.go_no_go` |

## Evidence schema

Evidence JSON uses `qa_marker: "apollo-live-pilot-ai-2-v1"`. Required sections:

- `company` — test company context
- `runtime` — duration, API calls, credits, errors
- `discovery` — mapped/skipped/synced counts
- `canonical_matching` — company + person matched/created/deduped/rejected
- `contact_quality` — decision maker, email, phone, title buckets
- `research_pipeline` — intelligence pipeline signals
- `readiness_funnel` — imported → sequence_ready counts

## Cost projections (from pilot)

Projections scale linearly from single-company pilot metrics:

| Scale | Uses |
|-------|------|
| 100 companies | `cost_projections[0]` |
| 500 companies | `cost_projections[1]` |
| 1000 companies | `cost_projections[2]` |

Search-only Apollo (`mixed_people/api_search`) typically consumes **0 credits** unless enrichment enabled.

## Recommended operating limits (default until live pilot overrides)

| Limit | Default |
|-------|---------|
| Companies per run | 1 (pilot) → 10 (next wave) |
| Contacts per company | ≤25 (env cap) |
| Safe pilot volume / day | 1–10 companies |
| Rollout volume / day | 5–25 companies |
| Bulk automated enrollment | **0** (disabled) |

Live pilot updates these via `analysis.operating_limits`.

## Go / No-Go criteria

| Verdict | Meaning |
|---------|---------|
| `go` | Live pilot verified — approved for **controlled production** (single-company / small batch pilots) |
| `conditional_go` | Partial validation — address blockers before expanding |
| `no_go` | Insufficient evidence — do not enable live Apollo beyond mock |

**Bulk enrollment remains `no_go` regardless** until separate operational sign-off.

## Certification

```bash
pnpm test:apollo-integration-ai-2
```

Report: [APOLLO_INTEGRATION_AI_2_CERTIFICATION_REPORT.md](./APOLLO_INTEGRATION_AI_2_CERTIFICATION_REPORT.md)

## Remaining gaps after AI-2

1. Multi-company live pilot wave (10 companies) with aggregated metrics
2. Email enrichment credit pilot (requires `GROWTH_APOLLO_ENRICH_EMAILS_ACK=1`)
3. Voice Drop × Apollo outreach (requires VD-4 live certification)
4. Rename `future_apollo` provider type in DB enum
