# Apollo Integration AI-3 — Live Pilot & Production Rollout Certification

Phase **AI-3** executes one real Apollo pilot and certifies whether Apollo is approved for **controlled production** usage. No new Apollo features.

## Execute live pilot

```bash
GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true
GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=<single-test-company-uuid>
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
APOLLO_API_KEY=...
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json

pnpm run:apollo-live-pilot-ai-3
```

Validate:

```bash
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json \
  pnpm test:apollo-integration-ai-3
```

## Deliverables (from certification output)

| # | Deliverable | Location in output |
|---|-------------|-------------------|
| 1 | Live pilot results | `certification.pilot` |
| 2 | Canonical results | `certification.analysis.canonical_matching` |
| 3 | Data quality | `certification.quality` |
| 4 | Readiness funnel | `certification.funnel` |
| 5 | Cost model | `certification.analysis.cost_per_company` + projections |
| 6 | Rollout plan | `certification.rollout` |
| 7 | Certification | `pnpm test:apollo-integration-ai-3` |
| 8 | Final go/no-go | `certification.final_go_no_go` |

## Final verdict meanings

| Verdict | Meaning |
|---------|---------|
| `approved` | Live evidence supports controlled production (Phase 1 limits) |
| `conditionally_approved` | Partial validation — Phase 1 only with daily ops review |
| `rejected` | Do not enable live Apollo beyond mock |

**Bulk enrollment is always rejected** (`approved_for_bulk_enrollment: false`).

## Multichannel (Apollo → Voice Drop)

Assessment only — no new implementation:

- Apollo import + sequence: approved when live evidence passes
- Voice Drop: blocked until `APOLLO_VD4_LIVE_CERTIFIED=true` (VD-4 live certification)
- Compliance, approval, and fatigue gates documented in `certification.multichannel`

## Related docs

- [APOLLO_INTEGRATION_AI_3_ROLLOUT_PLAN.md](./APOLLO_INTEGRATION_AI_3_ROLLOUT_PLAN.md)
- [APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md](./APOLLO_INTEGRATION_AI_2_LIVE_PILOT_CHECKLIST.md)
- [VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md](./VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md)

## Current status

**Live pilot evidence: PENDING** — no `.env.local` Apollo credentials in dev shell.

Until `pnpm run:apollo-live-pilot-ai-3` completes with `mock: false`, production approval remains **rejected**.
