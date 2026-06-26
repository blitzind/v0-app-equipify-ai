# GE-AIOS-GROWTH-5D — Autonomous Planning Agent

## Architecture

Four-layer pilot stack (same pattern as GE-AIOS-GROWTH-5B/5C):

| Layer | Module |
|-------|--------|
| Types | `growth-autonomous-planning-pilot-types.ts` |
| Engine | `growth-autonomous-planning-pilot-engine.ts` |
| Store | `growth-autonomous-planning-pilot-store.ts` (in-memory) |
| Service | `growth-autonomous-planning-pilot-service.ts` |

## Wake conditions

1. **qualification_completed** — qualified/assessed snapshot with confidence ≥ 0.45, evidence, no duplicate plan
2. **stale_execution_plan** — execution plan older than 7 days or drift from deterministic replan
3. **manual_planning_request** — reserved for explicit operator trigger path

Candidate selection uses mission priority queue missions `prepare_outreach`.

## Policy

All wakes consult `fetchGrowthAiOsAutonomyPolicyEvaluationContext()`. Blocks include emergency stop, autonomy disabled, recommendations capability off, planning agent disabled, budget/cooldown exhaustion, incomplete qualification, low confidence, Revenue Operator handoff block.

Control plane: Growth Autonomy only (`/growth/settings/autonomy`). Action API is 403.

## Planning engine

Deterministic evaluation reuses GE-AIOS-GROWTH-1C:

- `planGrowthLeadResearchExecution()` — workflow type, steps, prerequisites, readiness
- `assessGrowthLeadResearchOpportunity()` — intelligence when snapshot incomplete
- `buildGrowthLeadResearchExecutionPlanId()` — stable plan identity for duplicate detection

## Revenue Operator handoff

Completed runs emit `revenue_operator_handoff` recommendation:

- `handoff_to_revenue_operator` when plan ready
- `await_operator_approval` when approval required
- `human_review_required` when blocked

## UI surfaces

- Command Center diagnostics: `#autonomous-planning-pilot`
- AI Operations: active work + activity timeline entries
- Mission Planning Review: `autonomous-planning-pilot-context` on execution plan section

## Event type

`growth.execution_plan.generated` — planning lifecycle event with plan id, readiness, confidence, and handoff metadata.
