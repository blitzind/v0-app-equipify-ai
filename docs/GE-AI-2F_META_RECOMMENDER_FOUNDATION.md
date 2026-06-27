# GE-AI-2F — Meta-Recommender Foundation

**Status:** Complete (local certification, not committed)  
**Date:** 2026-06-25  
**Certification:** `pnpm test:ge-ai-2f-meta-recommender`

---

## Objective

Unify existing recommendation, scoring, prioritization, and intelligence signals into one **read-only** coordination layer for AI Operations, Revenue Operator, and future Revenue Director use.

The Meta-Recommender does **not** execute actions, mutate Core records, bypass Growth Autonomy, or send outbound communication.

---

## Architectural position

| Layer | Intelligence Engines |
| Consumers | AI Operations, Revenue Operator, Growth Objectives, future Revenue Director, future Human Approval Center |

---

## Source audit matrix

| Source | Current File(s) | Signal Type | Current Consumer | Reuse Strategy |
| ------ | --------------- | ----------- | ---------------- | -------------- |
| Lead Next-Best-Action | `lib/growth/next-best-action.ts`, `recompute-lead-next-best-action.ts` | Lead action recommendation | Lead workflow, inbox, cadence | Read persisted NBA via workflow read model — do not re-score |
| Engagement score | `lib/growth/engagement-score.ts` | Engagement tier/score | NBA, forecast, signals | Feature input only (future direct bind) |
| Relationship score | `lib/growth/relationship-score.ts` | Relationship tier/trend | NBA, forecast, executive | Feature input only |
| Opportunity readiness | `lib/growth/opportunity-readiness-score.ts` | Readiness tier/blockers | NBA, execution priority | Gate via workflow + mission priority |
| Revenue forecast | `lib/growth/revenue-forecast-score.ts` | Probability tier | NBA, executive dashboard | Feature input only |
| Executive operating | `lib/growth/executive-operating-score.ts` | Executive intervention | NBA | Escalation via attention items |
| Execution priority | `lib/growth/execution/execution-priority-score.ts` | Operator queue band | Execution dashboards | Future channel — not duplicated in 2F |
| Deal intelligence | `lib/growth/deal-intelligence/deal-recommendation-engine.ts` | Deal operator action | Deal dashboard | Future opportunity-scoped channel |
| Call intelligence | `lib/growth/call-intelligence/call-score-engine.ts` | Call quality/action | Call routes, deal bridge | Future channel |
| Territory intelligence | `lib/growth/territory-intelligence/territory-scoring.ts` | Territory bucket | Prospect search | Account-level channel (future) |
| Lead engine score | `lib/growth/lead-engine/lead-score-*` | Grade / priority | Lead engine | Pre-qualification channel (future) |
| SENDR intent | `lib/growth/sendr/growth-sendr-intent-scoring.ts` | Video intent | SENDR timeline | Future channel |
| Signal intelligence | `lib/growth/signal-intelligence/signal-recommendation-engine.ts` | Event recommendations | Command center unification | Future channel |
| Knowledge center | `lib/growth/knowledge-center/knowledge-recommendation-engine.ts` | Citation recs | Knowledge API | Content-advisory channel (future) |
| Playbook outcomes | `lib/growth/playbooks/outcomes/growth-playbook-outcome-engine.ts` | Messaging guidance | Personalization | Messaging bias layer (future) |
| Mission priority | `lib/growth/aios/growth/growth-mission-priority-engine.ts` | Mission ranking | AI Operations | **Integrated in 2F** |
| Revenue Operator | `lib/growth/aios/growth/growth-revenue-operator-orchestration-engine.ts` | Agent handoff recs | AI Operations | **Integrated in 2F** |
| Command center attention | `ai-os-command-center-service.ts` | Operator attention | AI Operations | **Integrated in 2F** |
| Lead research workflow | `growth-lead-research-workflow-service.ts` | Workflow NBA | AI Operations | **Integrated in 2F** |
| Execution plan review | `growth-lead-research-execution-plan-review-service.ts` | Plan approval queue | AI Operations | **Integrated in 2F** |

**Phase 2F scope:** Normalize signals already present on the AI OS Command Center read model. Do not duplicate standalone scoring engines.

---

## Canonical model

Types: `lib/growth/aios/recommendations/growth-meta-recommender-types.ts`

- `GrowthMetaRecommendation` — normalized recommendation with evidence and policy metadata
- `GrowthMetaRecommenderReadModel` — ranked read model with top 5 + full list (cap 50)
- `GrowthMetaRecommenderRevenueOperatorBinding` — read-only cross-link to orchestrations

---

## Ranking formula

```
score = impact * 0.35 + urgency * 0.25 + confidence * 0.25 - effort * 0.15
```

All dimensions normalized to **0–100**. Positive weights sum to **0.85**, so the theoretical maximum score (all inputs at 100, effort at 0) is **85**.

Deterministic tie-break: score desc → urgency desc → id asc.

---

## Implementation

| File | Role |
| ---- | ---- |
| `lib/growth/aios/recommendations/growth-meta-recommender-types.ts` | Client-safe types |
| `lib/growth/aios/recommendations/growth-meta-recommender-engine.ts` | Client-safe collectors + ranking |
| `lib/growth/aios/recommendations/growth-meta-recommender-service.ts` | Server-only wrapper |
| `lib/growth/aios/ai-os-command-center-service.ts` | Mounts `metaRecommender` on command center |
| `app/api/platform/growth/ai-os/recommendations/route.ts` | GET-only recommendations API |
| `components/growth/ai-os/command-center/growth-ai-os-meta-recommender-section.tsx` | Read-only UI (top 5) |

### Source collectors (isolated try/catch each)

1. `command_center.needs_attention`
2. `ai_work_orders.approval_queue`
3. `mission_priority.ranked_missions`
4. `mission_priority.starvation`
5. `revenue_operator.orchestrations`
6. `growth_lead_research_workflow`
7. `execution_plan_review_queue`

---

## Policy metadata

External action types (`email`, `sms`, `call`, `video`, `prepare_outreach`, `prepare_meeting`, `follow_up`, `review`) always set `policy.requiresHumanApproval: true`.

Growth Autonomy context (`emergencyStopActive`, `autonomyEnabled`) attaches `blockedReason` when applicable — CONSOLIDATION-1E compatible.

---

## Known limitations

- Does not yet ingest standalone lead NBA columns, deal intelligence, signal feed, or knowledge center directly — uses Command Center aggregates only
- No persistent recommendation cache (read model synthesized per request)
- No Revenue Director allocation — read-only foundation only
- Human Approval Center not built — approval metadata only

---

## Next recommended phase

**GE-AI-2E Priority Engine Binding** — bind mission priority outputs to objective runtime progression.

Then **GE-AI-2H L3 Human Approval Center** — unified approval surface for recommendations requiring human action.

---

## Tests

```bash
pnpm test:ge-ai-2f-meta-recommender
```

Regressions: PROD-REGRESSION-6, 5C, 4B Revenue Operator, 4F Mission Priority.

---

*No commit. No deploy.*
