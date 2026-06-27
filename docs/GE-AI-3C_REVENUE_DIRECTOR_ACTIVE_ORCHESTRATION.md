# GE-AI-3C — Revenue Director Active Orchestration

**Phase:** GE-AI-3C  
**Status:** Complete locally — not committed, not deployed  
**QA marker:** `growth-ge-ai-3c-revenue-director-active-orchestration-v1`

## Objective

Dispatch **accepted** Revenue Director workflow requests to existing Workflow Agents through a gated, idempotent orchestration layer. No direct transport, no scheduler, no bulk dispatch.

## Dispatch Audit Matrix

| Workflow Request Type | Target Agent | Current Invocation Path | Required Gate | Reuse Strategy |
| --------------------- | ------------ | ----------------------- | ------------- | -------------- |
| `run_research` | Research Agent | `runAutonomousResearchManualRefresh` | Research pilot autonomy gate + lead subject | Reuse 5B manual refresh — no provider outbound |
| `rerun_qualification` | Qualification Agent | `runAutonomousQualificationManualEvaluation` (new export) | Qualification pilot autonomy gate + snapshot | Mirror research manual path |
| `request_communication_plan` | Communication Engine | `requestGrowthCommunicationPlan` + event publish | Emergency stop off; planning only | GE-AI-2K read/plan service — no send |
| `generate_outreach` | Outreach Preparation Agent | `runAutonomousOutreachPreparationManualRequest` (new export) | Outreach prep autonomy gate + lead snapshot | Draft package only — `transport_blocked: true` |
| `review_approval_queue` | Human Approval Center | Route reference `/growth/os/approvals` | Operator role | No agent execution — route only |
| `pause_objective` | — | Advisory | Blocked in 3C | Ledger only |
| `allocate_more_budget` | — | Advisory | Blocked in 3C | Ledger only |
| `escalate_human` | — | Advisory | Blocked in 3C | Ledger only |
| `wait` | — | Advisory | Blocked in 3C | Ledger only |

## Allowed vs Blocked Request Types

**Allowed active dispatch:** `run_research`, `rerun_qualification`, `request_communication_plan`, `generate_outreach`, `review_approval_queue`

**Advisory-only in 3C:** `pause_objective`, `allocate_more_budget`, `escalate_human`, `wait`, direct outbound, sequence execution, Core mutations

## Adapter Map

| Adapter | Service | Sends? |
| ------- | ------- | ------ |
| Research | `growth-autonomous-research-pilot-service` | No |
| Qualification | `growth-autonomous-qualification-pilot-service` | No |
| Communication plan | `growth-communication-engine-service` | No |
| Outreach preparation | `growth-autonomous-outreach-preparation-pilot-service` | No |
| Approval queue | Route only | No |

## Idempotency Strategy

- Dispatch key: `rev-dir-dispatch:{workflowRequestId}`
- Requests already `dispatched` or `completed` return idempotent success without re-running adapters
- Ledger status transitions: `accepted` → `dispatched` → `completed` (when adapter completes synchronously)

## Event Lifecycle

- `growth.revenue_director.workflow_request_dispatch_requested`
- `growth.revenue_director.workflow_request_dispatched`
- `growth.revenue_director.workflow_request_dispatch_blocked`
- `growth.revenue_director.workflow_request_dispatch_failed`
- `growth.revenue_director.workflow_request_completed` (when adapter completes inline)

## UI Behavior

- Dispatch button only when `ledgerStatus === accepted` and eligibility passes
- Disabled button shows block reason
- Confirmation modal: target agent, request type, subject, evidence, policy note
- No bulk dispatch, auto-dispatch, send, or outbound approve controls

## Files Changed

| Path | Purpose |
| ---- | ------- |
| `growth-revenue-director-dispatch-types.ts` | Types, allowed types, events |
| `growth-revenue-director-dispatch-guardrails.ts` | Static gate validation |
| `growth-revenue-director-dispatch-adapters.ts` | Workflow Agent adapters |
| `growth-revenue-director-dispatch-service.ts` | Orchestration + events |
| `workflow-requests/[id]/dispatch/route.ts` | Operator-gated POST |
| `growth-ai-os-revenue-director-dispatch-button.tsx` | UI control + modal |
| `growth-autonomous-qualification-pilot-service.ts` | Manual evaluation export |
| `growth-autonomous-outreach-preparation-pilot-service.ts` | Manual preparation export |
| `growth-revenue-director-decision-service.ts` | Dispatch eligibility enrichment |
| `ai-event-registry.ts` | 4 new dispatch events |

## Tests Run

```bash
pnpm test:ge-ai-3c-revenue-director-active-orchestration
pnpm test:ge-ai-3b-revenue-director-decision-ledger
```

## Remaining Risks

- Async Workflow Agent completion not auto-mapped to ledger (requests may stay `dispatched` until manual completion)
- Manual pilot exports depend on scheduler-active control state under autonomy policy
- Production ledger schema still required for dispatch persistence

## GE-AI-3D Closed-Loop Learning

**Partially unblocked.** Dispatch produces durable lifecycle events and result references suitable for outcome ingestion, but GE-AI-2J Learning Loop and async completion correlation remain required for full closed-loop learning.
