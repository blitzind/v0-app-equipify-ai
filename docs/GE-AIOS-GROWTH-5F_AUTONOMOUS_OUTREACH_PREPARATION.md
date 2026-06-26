# GE-AIOS-GROWTH-5F — Autonomous Outreach Preparation Agent

## Purpose

Prove the Growth AI OS can autonomously **prepare** outreach assets after successful internal execution while keeping humans fully in control of anything that leaves the platform.

## Agent

| Property | Value |
|----------|--------|
| Agent kind | `outreach_agent` |
| Scheduler mode | `controlled_agent_wake` |
| Mode | **Preparation only** — no transport |
| Allowed workflow | `outreach_generation` (draft assembly) |
| Disabled agents | `meeting_agent` |

## Wake conditions

Outreach Agent may wake when:

- Internal execution completed successfully (`research_company` outcome eligible)
- Shared memory is complete
- Qualification confidence meets threshold (≥ 0.45)
- Planning and execution phases completed
- Revenue Operator ownership resolves to Outreach Agent
- Mission Priority Engine recommends outreach
- Unified autonomy policy permits outreach preparation

## Policy integration

Every wake path calls `fetchGrowthAiOsAutonomyPolicyEvaluationContext()` and `evaluateOutreachPreparationPilotAutonomyPolicyGate()`.

Pilot control state derives from `deriveOutreachPreparationPilotControlFromPolicy()` — configured only in **Growth Autonomy** (no duplicate Command Center controls).

Outreach Agent enablement uses `autonomyGenerationEnabled` (not `autonomyOutboundEnabled`) so preparation works while outbound send remains off.

## Budget and throttle

| Limit | Value |
|-------|--------|
| Hourly preparations | 20 |
| Daily preparations | 200 |
| Retries per lead per day | 3 |
| Cooldown after failure | 30 minutes |

Enforced in `enforceOutreachPreparationAgentBudget()` and reflected in policy telemetry via outreach pilot run history.

## Draft generation (reuse only)

`growth-autonomous-outreach-preparation-draft-service.ts` orchestrates existing systems:

- `runOutreachPersonalizationGeneration` — email drafts
- `runSmsPersonalizationForLead` — SMS drafts
- `buildCadenceLinkedInDraft` — LinkedIn message drafts
- `buildCadenceTaskInstructions` — call talking points
- `previewSendrPersonalization` — SENDR recommendations (preview only)

No transport, provider execution, or enrollment paths are invoked.

## Approval package

Each prepared package includes:

- Generated assets (email, SMS, LinkedIn, call, SENDR, follow-up summaries)
- Personalization evidence and supporting research
- Confidence, approval requirements, compliance notes
- Recommended channel, sequence, and expected outcome
- `pendingHumanApproval: true` and `transportBlocked: true`

## Operator surfaces

### AI Operations

Compact `outreachAgentStatus` block: enabled state, drafts prepared, approval packages waiting, blocked preparations, budget usage, latest prepared assets.

### Mission Planning Review

Per-lead `autonomousOutreachPreparationPilotContext`: outreach readiness, approval package status, prepared assets, personalization confidence, blocked reasons, Revenue Operator handoff.

### Growth Autonomy

Outreach Agent appears as policy-controlled via `outreachAutonomyEnabled` — no duplicate pilot toggles elsewhere.

## Events

- `agent.wake` — Outreach Agent wake with preparation context
- `growth.outreach.prepared` — Draft approval package published (pending human approval)
