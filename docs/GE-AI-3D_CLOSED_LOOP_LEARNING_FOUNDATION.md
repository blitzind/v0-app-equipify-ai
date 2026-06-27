# GE-AI-3D — Closed-Loop Learning Foundation

**Phase:** GE-AI-3D  
**Status:** Complete locally — not committed, not deployed  
**QA marker:** `growth-ge-ai-3d-closed-loop-learning-foundation-v1`

## Objective

Capture outcomes from existing Event Bus sources, normalize into `GrowthLearningOutcome`, synthesize advisory `GrowthLearningInsight` records, and expose read-only context to Revenue Director, Communication Engine, and AI Operations — **no automatic score, ICP, channel, or policy mutation**.

## Outcome Source Audit

| Outcome Source | Event/Table/File | Outcome Signal | Existing Consumer | Reuse Strategy |
| -------------- | ---------------- | -------------- | ----------------- | -------------- |
| Revenue Director dispatch correlation | `growth.revenue_director.workflow_request_correlation_*` | completed / failed | Dispatch correlation observer | Subscribe via `learning_observer` |
| Research Agent | `growth.workflow.status_changed` | research_complete / failed | Correlation, agent events | Reuse constant + payload |
| Qualification Agent | `growth.qualification.completed` | qualified / failed | Correlation | Reuse constant |
| Outreach / Communication | `growth.outreach.prepared`, `growth.communication.plan_generated` | package / plan ready | Correlation, Comm Engine | Reuse constants |
| Autonomous outbound actions | `growth.autonomous_outbound.action_*` | completed / failed / blocked | Bounded outbound section | Bus subscription + scope IDs |
| Email/SMS replies | `growth.autonomous_outbound.stop_condition_triggered` (`on_reply`) | reply | Stop conditions, attribution | Channel dimension on stop event |
| Bounces / unsub / opt-out | stop conditions `on_bounce`, `on_unsubscribe`, `on_opt_out` | negative outcomes | Compliance, deliverability | Normalize without duplicating analytics tables |
| Meeting booked | stop `on_meeting_booked`, `mission.signal.ingested` | meeting_booked | Objective router, attribution | Reuse signal types |
| Human approval | `growth.execution_plan.review_changed`, `decision.recorded` | approved / rejected | Human Approval Center | Supervised labels only |
| Campaign / sequence performance | `growth.message_events`, performance snapshots | rollups | Revenue intelligence | Future batch bridge — not duplicated in 3D |
| Attribution touches | `growth.attribution_touches` | cross-channel spine | Closed-loop rollups | Future replay source |

## Outcome Model

Canonical type: `GrowthLearningOutcome` in `growth-closed-loop-learning-types.ts`.

In-memory bounded store (500 outcomes/org) — read-model cache pattern, no new DB table in this phase.

## Insight Model

Canonical type: `GrowthLearningInsight` with:

- `insightType`, `recommendedAdjustment`, `targetSystem`
- `confidence`, `impact`, `sampleSize`
- `status`: `advisory` | `needs_review` | `not_enough_data` (sample &lt; 3)

Insight generators: channel performance, approval friction, outbound risk, objective progress.

## Read-Only Boundaries

- No automatic scoring / ICP / channel weight / autonomy policy changes
- No transport execution, no Core mutation, no scheduler/polling
- Revenue Director and Communication Engine consume advisory context only
- UI: outcomes + insights visible; no Apply / retry controls

## Event Bus Integration

**Subscriber:** `learning_observer`

**Publishes:**

- `growth.learning.outcome_observed`
- `growth.learning.insight_generated`

## Integrations

| Surface | Behavior |
| ------- | -------- |
| Revenue Director | `learningAdvisory` — top insight, risk/channel trends, approval friction |
| Communication Engine | `learningAdvisory.advisoryNote` — e.g. SMS outperforming email (ranking unchanged) |
| AI Operations | `GrowthAiOsClosedLoopLearningSection` on operations dashboard |

## Files Changed

| Path | Purpose |
| ---- | ------- |
| `growth-closed-loop-learning-types.ts` | Outcome + insight types |
| `growth-learning-outcome-normalizer.ts` | Event → outcome mapping |
| `growth-learning-insight-engine.ts` | Outcome grouping → insights |
| `growth-closed-loop-learning-service.ts` | Store, observe, enrich, publish |
| `growth-ai-event-bus-engine.ts` | Register `learning_observer` |
| `growth-ai-event-bus-subscriber-registry.ts` | Wire handler |
| `ai-os-command-center-service.ts` | Read model + enrichments |
| `growth-ai-os-closed-loop-learning-section.tsx` | Read-only UI |

## Tests Run

```bash
pnpm test:ge-ai-3d-closed-loop-learning-foundation
pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation
```

## Remaining Risks

- In-memory outcome store resets on process restart — durable store deferred
- Campaign/sequence/attribution batch replay not wired yet
- `conversation.reply_received` bus stub — stop-condition bridge used instead
- Insight calibration is heuristic — not ML-backed yet

## Controlled Adaptive Learning

**Partially unblocked.** Outcome normalization, insight synthesis, and advisory fan-out are in place. **GE-AI-3D-PROD-1 / GE-AI-2J** controlled calibration (operator-approved weight changes) remains a follow-on phase.
