# Apollo Integration AI-5 — Production Activation & First Outreach Certification

Phase **AI-5** certifies the first complete production-ready outbound workflow from live Apollo pilot evidence:

**Apollo → Canonical → Research → Scoring → Sequence Readiness → Sequence Enrollment → Email / SMS / Voice Drop eligibility**

Assessment only — **no outreach execution**, no new providers, channels, or AI features.

## Prerequisites

1. Complete AI-4 live pilot: `pnpm run:apollo-live-pilot-ai-3`
2. Evidence file: `./evidence/apollo-ai-3-pilot.json`

## Run certification

```bash
APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-5
```

Fallback env vars: `APOLLO_AI_3_PILOT_EVIDENCE_JSON`, or default path `./evidence/apollo-ai-3-pilot.json` if present.

Optional flags (same as AI-3):

```bash
APOLLO_VD4_LIVE_CERTIFIED=true
VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true
```

## Deliverables (certification output)

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Live evidence summary | `live_evidence_summary` |
| 2 | Pipeline funnel | `pipeline.counts` + `pipeline.stages` |
| 3 | Channel readiness | `channel_readiness.channels` |
| 4 | Quality benchmark | `quality_benchmark.metrics` |
| 5 | Rollout limits | `rollout_limits.weeks` |
| 6 | Activation decision | `activation_decision.verdict` |
| 7 | Certification harness | `pnpm test:apollo-integration-ai-5` |

## Activation verdict meanings

| Verdict | Meaning |
|---------|---------|
| `approved` | Live evidence validates E2E pipeline, sequence readiness, and channel eligibility — controlled production + first human-approved enrollments |
| `conditionally_approved` | Partial validation — Week 1 limits only, daily ops review, address documented failures before enrollment |
| `rejected` | Do not activate — mock/malformed evidence or thresholds not met |

**Bulk enrollment always rejected** (`approved_for_bulk_enrollment: false`).

## Pipeline stages measured

```
Imported → Canonical → Research → Scored → Contactable → Sequence Ready
```

Each stage includes counts, fallout, and conversion rates.

## Channel readiness (assessment only)

| Channel | Requirements assessed |
|---------|----------------------|
| Email | Email present, verified state |
| SMS | Phone present, compliance orchestration |
| Voice Drop | Phone + VD-4 certification + compliance |
| Calling | Callable number + compliance |

No messages, calls, or Voice Drops are sent during certification.

## Rollout limits

Week 1, Week 2, Week 3, and Ongoing guidance includes:

- companies/day
- contacts/day
- enrollments/day

Derived from live pilot baseline (contacts/company, sequence-ready/company).

## Rollback / disable

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false
GROWTH_DISCOVERY_DISABLE_APOLLO=1
```

Pause Apollo-linked sequence patterns and pending outreach jobs.

## Related docs

- [APOLLO_INTEGRATION_AI_4.md](./APOLLO_INTEGRATION_AI_4.md)
- [APOLLO_INTEGRATION_AI_3.md](./APOLLO_INTEGRATION_AI_3.md)
- [APOLLO_INTEGRATION_AI_3_ROLLOUT_PLAN.md](./APOLLO_INTEGRATION_AI_3_ROLLOUT_PLAN.md)

## Current status

**Production activation: PENDING** — load live pilot evidence from successful AI-4 execution.

Until real `apollo-ai-3-pilot.json` is certified, activation remains **rejected**.
