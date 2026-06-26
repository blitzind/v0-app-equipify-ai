# GE-AIOS-CONSOLIDATION-1E — Policy Unification

## Objective

Growth Autonomy owns **configuration** (1C). The Policy Engine owns **evaluation** (1E).

Every autonomous decision flows:

```
fetchGrowthAiOsAutonomyPolicyEvaluationContext()
        ↓
evaluateAutonomyCapabilityFromPolicyEngine / gates / enrich helpers
        ↓
allow | block + reason + policyKey
```

## Legacy wrappers

| Function | Role after 1E |
|----------|----------------|
| `evaluateAutonomyCapability` | Delegates to `evaluateAutonomyCapabilityFromPolicyEngine` |
| `evaluateAutonomyOutboundSendPolicy` | Delegates to `evaluateAutonomyOutboundSendPolicyFromPolicyEngine` |

Wrappers preserve `GrowthAutonomyPolicyResult` and outbound send evaluation contracts for GE-AUTO enforcement and automation runtime.

## Subsystem integration

| Subsystem | Evaluation entry |
|-----------|------------------|
| GE-AUTO enforcement | Legacy wrappers → policy engine |
| Outbound send | Legacy wrapper → policy engine |
| Execution runtime | `evaluateRuntimeAutonomyPolicyGate` |
| Research pilot | `evaluateResearchPilotAutonomyPolicyGate` |
| Scheduler readiness | `enrichSchedulerReadinessWithAutonomyPolicy` in service |
| Command Center safe mode | `buildCommandCenterSafeModeFromPolicy` |
| Revenue Operator | `annotateOrchestrationWithPolicy` on read model |

## Research Agent

- Control state synced from policy on Growth Autonomy patch
- `POST …/autonomous-research-pilot/action` returns 403 with `configureHref`
- Manual and autonomous refresh share the same policy gate

## Runtime overrides

Removed from HTTP request bodies:

- `runtimeEnabled` / `pilotEnabled` on enqueue
- `runtimeEnabled` on resume

Internal test helpers may still pass overrides to `validateGrowthLeadResearchExecutionPilotEnqueue` — not exposed via public API.

## Deployment guardrails (unchanged)

`GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_*` env flags remain deployment-level guardrails read through the policy engine's `runtimeEnabled` / `runtimePilotEnabled` fields. They are not Growth Autonomy UI controls.
