# GE-AIOS-CONSOLIDATION-1C — Autonomy Control Plane

## Primary principle

**Growth Autonomy answers: "What is AI allowed to do?"**

Every autonomous subsystem evaluates the canonical policy layer before acting. AI Operations answers **"What is AI doing?"** — read-only summaries with deep links back to Growth Autonomy.

## Control plane path

`/growth/settings/autonomy` — sole write surface for:

- Operating mode
- Agent enablement (capability toggles)
- Scheduler mode (derived from operating mode)
- Human approval requirements
- Shadow / preview mode
- Budget and daily limits
- Kill switches and emergency stop
- Outbound permissions
- Research autonomy (5B pilot)
- Runtime enablement flags (consulted, not owned)

## Policy engine architecture

```
organization_autonomy_settings
runtime_guardrail_settings (kill switches)
runtime_budgets
autonomous research pilot store (telemetry)
execution runtime env flags
        ↓
fetchGrowthAiOsAutonomyPolicy()
        ↓
GrowthAiOsAutonomyPolicyReadModel
        ↓
Consumers (read-through enrichment)
```

No duplicate storage. Policy is synthesized at read time from existing sources.

## Policy model fields

| Field | Source |
|-------|--------|
| `operatingMode` | `organization_autonomy_settings.master_mode` |
| `schedulerMode` | Derived from operating mode + autonomy enabled |
| `enabledAgents` | Capability toggles + kill switches |
| `runtimeEnabled` | Runtime lifecycle flags + policy gate |
| `outboundEnabled` | Kill switch + outbound controls |
| `shadowModeEnabled` | Outbound controls |
| `researchAutonomyEnabled` | Research capability + agent policy |
| `dailyBudgets` | Runtime budget snapshots |
| `hourlyBudgets` | Research pilot budget consumption |
| `emergencyStopActive` | Autonomy kill switch |
| `agentStates[]` | Per-agent enabled / disabled reason / permissions |

## UI mapping

| Growth Autonomy control | AI OS integration |
|-------------------------|-------------------|
| Operating mode | Scheduler Readiness `policySchedulerMode` |
| Shadow mode | Dry run + simulation context |
| Capability toggles | Agent Framework `agentAutonomyPolicy` |
| Daily limits | Priority Engine budget snapshots |
| Emergency stop | Policy kill switch |
| Human approval | Execution plan review policies |
| Research capability | 5B Autonomous Research pilot |

## AI Operations (read-only)

- Executive overview: operating mode label + `configureHref`
- Autonomy state card: mode, autonomy, emergency stop, shadow mode, active agents
- Engineering diagnostics: pilot section read-only with deep link
- No write controls for autonomy configuration

## Runtime integration

`buildExecutionRuntimeValidation` calls `evaluateRuntimeAutonomyPolicyGate` before enqueue/resume validation. Effective `runtimeEnabled` requires both env flag and policy gate.

## Research pilot integration

`runAutonomousResearchPilotCycle` consults `evaluateResearchPilotAutonomyPolicyGate` and `deriveResearchPilotControlFromPolicy`. Growth Autonomy settings patch syncs pilot control state via `syncAutonomousResearchPilotFromPolicy`.

## QA marker

`growth-aios-consolidation-1c-autonomy-policy-v1`
