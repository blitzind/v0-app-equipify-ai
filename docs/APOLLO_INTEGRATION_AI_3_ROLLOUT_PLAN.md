# Apollo Controlled Rollout Plan (AI-3)

Derived from live pilot evidence via `buildApolloControlledRolloutPlan()`. Defaults apply until real pilot JSON is captured.

## Phase 1 — Controlled pilot wave

| Parameter | Value |
|-----------|-------|
| Volume | **1–10 companies/day** |
| Entry | Live AI-3 pilot evidence; `GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1` |
| Approval | Platform admin per company; human approval per sequence job |
| Monitoring | Daily evidence metrics; sync ratio; canonical linkage; funnel conversion |
| Rollback | API errors >15%/24h; duplicate person spike; compliance block >25% |

## Phase 2 — Limited production

| Parameter | Value |
|-----------|-------|
| Volume | **10–25 companies/day** |
| Entry | 7 days Phase 1 green; quality composite ≥70; ≥1 sequence-ready/company avg |
| Approval | Daily guardrail review; campaign approval for message variants |
| Monitoring | Weekly cost vs projection; 10% decision-maker spot-check |
| Rollback | Same as Phase 1 triggers |

## Phase 3 — Scaled controlled rollout

| Parameter | Value |
|-----------|-------|
| Volume | **25–100 companies/day** |
| Entry | 30 days Phase 2; quality grade good/excellent 2 weeks; VD-4 if Voice Drops |
| Approval | Ops lead for volume above Phase 2; pre-approved patterns only |
| Monitoring | Guardrail alerts; engagement by Apollo source |
| Rollback | Phase 1 triggers + carrier/compliance escalation |

## Global rollback

1. `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false`
2. `GROWTH_DISCOVERY_DISABLE_APOLLO=1`
3. Pause Apollo-linked sequence patterns
4. Cancel pending voice_drop / SMS jobs

## Hard limits (unchanged)

- Bulk automated enrollment: **disabled**
- Max contacts per company: **25** (env cap)
- Max API calls per run: **60** (env cap)
- Voice Drop at scale: requires VD-4 live certification

## Cost model (search-only default)

From pilot `cost_per_company`:

- API calls × companies = projected API volume
- Credits × companies = projected spend (0 for search-only)
- Sequence-ready rate × contacts × companies = outreach capacity estimate

Re-run projections after live pilot:

```bash
APOLLO_AI_3_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json pnpm test:apollo-integration-ai-3
```
