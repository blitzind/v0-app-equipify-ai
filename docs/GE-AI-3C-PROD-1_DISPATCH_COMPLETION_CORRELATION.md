# GE-AI-3C-PROD-1 — Revenue Director Dispatch Completion Correlation

**Phase:** GE-AI-3C-PROD-1  
**Status:** Complete locally — not committed, not deployed  
**QA marker:** `growth-ge-ai-3c-prod-1-dispatch-completion-correlation-v1`

## Objective

Close the loop from accepted workflow request → dispatch → Workflow Agent outcome → Decision Ledger update using Event Bus observation — no polling, no scheduler, no transport.

## Completion Event Audit

| Agent | Completion Event | Failure Event | Result Reference | Correlation Strategy |
| ----- | ---------------- | ------------- | ---------------- | -------------------- |
| Research Agent | `growth.workflow.status_changed` (research_complete/assessed) | same event with blocked/failed status | lead entityId | Match dispatched `run_research` by leadId |
| Qualification Agent | `growth.qualification.completed` | payload qualification_status failed/blocked | lead entityId | Match dispatched `rerun_qualification` by leadId |
| Outreach Preparation | `growth.outreach.prepared` | `agent.failed` | package_id or lead | Match dispatched `generate_outreach` by leadId |
| Communication Engine | `growth.communication.plan_generated` | — | planId in payload | Match `request_communication_plan` by subject |
| Human Approval Center | route-only (sync complete in 3C) | — | route href | N/A — completes at dispatch |
| Planning / Execution / Meeting | lifecycle aliases exist | `agent.failed` | work order refs | Not wired in 3C-PROD-1 (conservative) |

## Correlation Strategy

1. **Subscriber:** `revenue_director_dispatch_correlation_observer` on Event Bus (in-process, event-driven)
2. **Match:** dispatched workflow requests (`status = dispatched`) by request type + lead/subject + recency
3. **Idempotency:** decision event payload `correlationId = rev-dir-corr:{workflowRequestId}:{eventId}`
4. **Persistence:** ledger workflow request status + append-only decision events (no new table; `failed_at` deferred to future migration)
5. **Stale rule:** dispatched > 24h without completion → read-model `stale` warning (deterministic, no polling)

## Event Mappings

| Incoming Event | Ledger Transition |
| -------------- | ----------------- |
| Research workflow status complete | `dispatched` → `completed` |
| Qualification completed | `dispatched` → `completed` |
| Outreach prepared | `dispatched` → `completed` |
| Communication plan generated | `dispatched` → `completed` |
| Agent failed | `dispatched` → `failed` |
| Dispatch failed (Revenue Director) | `dispatched` → `failed` |

Published lifecycle events:

- `growth.revenue_director.workflow_request_correlation_matched`
- `growth.revenue_director.workflow_request_correlation_completed`
- `growth.revenue_director.workflow_request_correlation_failed`

## Ledger Update Behavior

- Updates `status`, `completed_at` on match
- Stores `resultReference`, `evidence`, `eventId` in decision event payload
- Ignores unrelated events, terminal requests, duplicate correlation IDs
- Schema missing → subscriber returns gracefully without crash

## Files Changed

| Path | Purpose |
| ---- | ------- |
| `growth-revenue-director-dispatch-correlation-types.ts` | Types, event resolution, matching |
| `growth-revenue-director-dispatch-correlation-service.ts` | Apply correlation + observe hook |
| `growth-ai-event-bus-subscriber-registry.ts` | Wire subscriber handler |
| `growth-ai-event-bus-types.ts` / `growth-ai-event-bus-engine.ts` | Register observer |
| `growth-revenue-director-decision-service.ts` | Read-model correlation enrichment |
| `growth-ai-os-revenue-director-section.tsx` | Read-only status visibility |
| `ai-event-registry.ts` | Correlation lifecycle events |

## Tests Run

```bash
pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation
pnpm test:ge-ai-3c-revenue-director-active-orchestration
pnpm test:ge-ai-3b-revenue-director-decision-ledger
pnpm test:ge-ai-3a-revenue-director-foundation
pnpm test:ge-ai-2k-communication-engine
pnpm test:ge-ai-2b-event-bus-completion
```

## `.env.build` Supabase Key Audit

Cert uses a **bounded** in-process parser (256 KiB cap, key names only) — not shell `grep`/`wc`. Expected Supabase keys when `.env.build` is present:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Ad-hoc scans that pipe to `wc -c` without a file can hang indefinitely on stdin; do not use that pattern.

## Remaining Risks

- Service role client required for in-process correlation (fails closed if unavailable)
- Planning/execution/meeting agents not correlated in this conservative phase
- No `failed_at` column yet — failure timestamp lives in decision events only
- Multiple dispatched requests for same lead resolve to most recent dispatch

## GE-AI-3D Closed-Loop Learning

**Largely unblocked.** Dispatch → agent outcome → ledger completion loop is event-driven with preserved result references and evidence suitable for GE-AI-2J learning ingestion. Remaining: formal outcome subscription from learning loop and optional `failed_at`/result_reference columns.
