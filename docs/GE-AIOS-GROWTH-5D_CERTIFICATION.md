# GE-AIOS-GROWTH-5D — Certification

| Field | Value |
|-------|--------|
| **Phase** | GE-AIOS-GROWTH-5D |
| **Title** | Autonomous Planning Agent Pilot |
| **Status** | Complete (local cert) |
| **Cert command** | `pnpm test:ge-aios-growth-5d-autonomous-planning-agent` |

## Scope

Enable **Planning Agent** as the third controlled autonomous Growth AI OS agent. Research and Qualification agents remain active. Execution, Outreach, and Meeting agents stay disabled. Revenue Operator remains supervisory.

## Delivered

- `growth-autonomous-planning-pilot-*` — types, engine, store, service (mirrors 5B/5C pilot pattern)
- Policy gates via `fetchGrowthAiOsAutonomyPolicyEvaluationContext` + `evaluatePlanningPilotAutonomyPolicyGate`
- Budget: 15/hr, 150/day, 2 retries/lead/day, 30 min failure cooldown
- Wraps `planGrowthLeadResearchExecution` (no duplicate planning logic)
- Events: `agent.wake`, `growth.workflow.status_changed`, `growth.execution_plan.generated`
- Command Center + AI Operations + Mission Planning Review read-only surfaces
- Legacy action API returns 403 → Growth Autonomy

## Regression chain (cert)

- GE-AIOS-GROWTH-5C Autonomous Qualification Agent Pilot (includes 5B → 5A)

## Constraints verified

- No Work Orders, runtime enqueue, outbound, providers, or Core mutations
- Policy engine is sole gate — no legacy autonomy settings reads in pilot service
- Research, Qualification, and Planning agents may wake under controlled_agent_wake; Execution/Outreach/Meeting remain blocked
