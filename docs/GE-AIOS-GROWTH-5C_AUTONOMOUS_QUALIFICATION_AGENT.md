# GE-AIOS-GROWTH-5C — Autonomous Qualification Agent

## Architecture

Four-layer pilot stack (same pattern as GE-AIOS-GROWTH-5B):

| Layer | Module |
|-------|--------|
| Types | `growth-autonomous-qualification-pilot-types.ts` |
| Engine | `growth-autonomous-qualification-pilot-engine.ts` |
| Store | `growth-autonomous-qualification-pilot-store.ts` (in-memory) |
| Service | `growth-autonomous-qualification-pilot-service.ts` |

## Wake conditions

1. **research_completed** — fresh `research_complete` snapshot with evidence, no recent qualification run
2. **stale_qualification** — prior qualification older than 24h
3. **manual_qualification_request** — reserved for explicit operator trigger path

Candidate selection uses mission priority queue missions `qualify_lead` and `identify_buying_committee`.

## Policy

All wakes consult `fetchGrowthAiOsAutonomyPolicyEvaluationContext()`. Blocks include emergency stop, autonomy disabled, enrichment capability off, qualification agent disabled, budget/cooldown exhaustion, missing research, Revenue Operator handoff block.

Control plane: Growth Autonomy only (`/growth/settings/autonomy`). Action API is 403.

## Qualification engine

Deterministic evaluation reuses GE-AIOS-GROWTH-1A/1B:

- `qualifyGrowthLeadResearch()` — ICP fit, confidence, status
- `assessGrowthLeadResearchOpportunity()` — buying signals, NBA (when qualified)

Snapshot builder `buildResearchResultFromWorkflowSnapshot()` bridges workflow evidence to research result input.

## Revenue Operator handoff

Completed runs emit `revenue_operator_handoff` recommendation:

- `handoff_to_planning_agent` when qualified
- `human_review_required` when blocked
- `continue_research` when failed

## UI surfaces

- Command Center diagnostics: `#autonomous-qualification-pilot`
- AI Operations: active work + activity timeline entries
- Mission Planning Review: `autonomous-qualification-pilot-context` on execution plan section

## New event type

`growth.qualification.completed` — documented because no prior AI OS growth event carried full autonomous qualification payload with handoff metadata.
