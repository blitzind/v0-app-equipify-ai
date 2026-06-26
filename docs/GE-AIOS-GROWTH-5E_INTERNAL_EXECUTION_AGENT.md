# GE-AIOS-GROWTH-5E — Internal Execution Agent Pilot

## Purpose

Prove the Growth AI OS can move from autonomous planning into **controlled internal execution** without touching outbound channels, Work Orders, or Equipify Core.

## Agent

| Property | Value |
|----------|--------|
| Agent kind | `execution_agent` |
| Scheduler mode | `controlled_agent_wake` |
| Allowed workflow | `research_company` only |
| Disabled agents | `outreach_agent`, `meeting_agent` |

## Wake conditions

Execution Agent may wake when:

- Planning Agent generated an approved execution plan
- Workflow is `research_company`
- Readiness is `ready_for_future_execution`
- Handoff is `handoff_ready`
- Preflight passed
- Dry-run passed
- Mission Priority Engine allocates execution capacity
- Revenue Operator does not block handoff
- Unified autonomy policy permits execution

## Policy integration

Every wake and enqueue path calls `fetchGrowthAiOsAutonomyPolicyEvaluationContext()` and `evaluateExecutionPilotAutonomyPolicyGate()`.

Pilot control state derives from `deriveExecutionPilotControlFromPolicy()` — configured only in **Growth Autonomy** (no duplicate Command Center controls).

Runtime flags flow through `policyDerivedFlags` on `validateGrowthLeadResearchExecutionPilotEnqueue` and `buildExecutionRuntimePilotPlanQueues`.

## Budget and throttle

| Limit | Value |
|-------|--------|
| Hourly executions | 5 |
| Daily executions | 25 |
| Retries per plan per day | 2 |
| Cooldown after failure | 30 minutes |

Enforced in `enforceExecutionAgentBudget()` and reflected in policy telemetry via execution pilot run history.

## Runtime integration

Uses existing GE-AIOS-GROWTH-3A–3C runtime services. No new runtime created.

State transitions remain: `queued` → `validating` → `ready` → `executing` → `completed` | `failed` | `paused` | `cancelled`.

## Operator surfaces

### AI Operations

Compact `executionAgentStatus` block: enabled state, eligible/queued/active/completed/failed/blocked counts, budget usage, latest lifecycle event.

### Mission Planning Review

Per-plan `autonomousExecutionPilotContext`: eligibility, dry-run status, runtime state, blocked reasons, Revenue Operator handoff, wake recommendation.

### Growth Autonomy

Execution Agent appears as policy-controlled via `executionAutonomyEnabled` and task-creation capability — no duplicate pilot toggles elsewhere.

## Events

- `agent.wake` — Execution Agent wake with `workflow_type: research_company`
- `growth.execution.enqueued` — Runtime execution enqueued after gates pass
