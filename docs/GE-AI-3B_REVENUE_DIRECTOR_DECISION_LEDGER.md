# GE-AI-3B — Revenue Director Decision Ledger

**Phase:** GE-AI-3B  
**Status:** Complete locally — not committed, not deployed  
**QA marker:** `growth-ge-ai-3b-revenue-director-decision-ledger-v1`  
**Migration:** `20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql`

## Objective

Persist Revenue Director advisory decisions and workflow requests so future active orchestration can be idempotent, auditable, and stateful. This phase remains **advisory only** — no auto-dispatch, no outbound execution, no scheduler activation.

## Persistence Audit

| Pattern | Table/File | Existing Lifecycle | Reuse Strategy |
| ------- | ---------- | ------------------ | -------------- |
| AI decision records | `growth.ai_decision_records` + audit events | Insert-only mission decisions | Reference pattern for evidence + append-only audit; do not merge — Revenue Director needs executive snapshot scope |
| AI OS events | `growth.ai_os_events` | Append-only bus persistence | Reuse `publishGrowthAiEvent` for lifecycle emissions |
| Autonomous outbound scopes | `growth.autonomous_outbound_scopes` + actions + events | Propose → approve → activate → complete | Reuse idempotency pre-insert + partial unique index + duplicate re-fetch |
| AI work order events | Work order runtime tables | Status transitions | Reference only — Workflow Agents remain authoritative for execution |
| Revenue Operator orchestration | Query-time read models | Ephemeral synthesis | Revenue Director consumes Command Center projection only |
| Objective/runtime records | Objectives + mission framework | DB-backed objectives | Subject references on workflow requests (`objective_id`, `mission_id`, `lead_id`) |
| Mission priority output | Query-time binding read model | Ephemeral per read | Evidence preserved on ledger rows |
| Approval audit records | Human Approval Center + scope events | Operator-gated transitions | Accept/cancel routes use `requireGrowthOperatorAccess`; no dispatch |
| Growth Autonomy audit | Policy read model + kill switches | Read-only enforcement | Ledger respects `requires_human_approval`; no policy bypass |
| Idempotency keys | Outbound scope actions, ledger workflow requests | `organization_id + idempotency_key` unique | `rev-dir-req:{orgId}:{advisoryRequestId}` stable from GE-AI-3A engine IDs |

## Data Model

### `growth.revenue_director_decisions`

Executive decision derived from a Command Center snapshot. Unique active decision per `(organization_id, snapshot_hash)` when status is `proposed` or `accepted`.

### `growth.revenue_director_workflow_requests`

Durable advisory request to a Workflow Agent. Unique per `(organization_id, idempotency_key)`. Preserves evidence JSON and route hint. Always `advisory = true`.

### `growth.revenue_director_decision_events`

Append-only lifecycle audit: `proposed`, `accepted`, `dispatched`, `completed`, `failed`, `cancelled`, `superseded`, `expired`.

## Lifecycle

| Transition | Trigger | Dispatch? |
| ---------- | ------- | --------- |
| propose | Command Center sync | No |
| accept | Operator POST | No |
| cancel | Operator POST | No |
| supersede | New snapshot supersedes stale proposed decisions | No |
| complete | Manual/service completion (future 3C) | No in 3B |

## Idempotency Strategy

- **Snapshot hash:** deterministic hash from org, generated-at (hour bucket), revenue health, sorted advisory request IDs
- **Workflow request key:** `rev-dir-req:{organizationId}:{advisoryRequestId}` where `advisoryRequestId` is the stable GE-AI-3A `stableId()` output
- Regenerated recommendations with the same advisory ID resolve to existing ledger rows — UI shows `proposed`/`accepted` instead of duplicate `new` rows

## Event Bus Integration

Registered and published (non-blocking):

- `growth.revenue_director.decision_proposed`
- `growth.revenue_director.decision_accepted`
- `growth.revenue_director.decision_cancelled`
- `growth.revenue_director.decision_superseded`
- `growth.revenue_director.workflow_request_proposed`
- `growth.revenue_director.workflow_request_accepted`
- `growth.revenue_director.workflow_request_completed`

## Files Changed

| Path | Purpose |
| ---- | ------- |
| `supabase/migrations/20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql` | Tables, indexes, RLS, triggers |
| `lib/growth/aios/revenue-director/growth-revenue-director-decision-types.ts` | Client-safe types |
| `lib/growth/aios/revenue-director/growth-revenue-director-decision-helpers.ts` | Hash, idempotency, transitions |
| `lib/growth/aios/revenue-director/growth-revenue-director-decision-repository.ts` | Persistence |
| `lib/growth/aios/revenue-director/growth-revenue-director-decision-schema-health.ts` | Graceful degrade |
| `lib/growth/aios/revenue-director/growth-revenue-director-decision-service.ts` | Sync, accept, cancel, enrich |
| `lib/growth/aios/revenue-director/growth-revenue-director-types.ts` | Ledger fields on read model |
| `lib/growth/aios/ai-os-command-center-service.ts` | Ledger sync on Command Center read |
| `lib/growth/aios/ai-os-command-center-types.ts` | `revenueDirectorDecisionLedger` field |
| `lib/growth/aios/ai-event-registry.ts` | 7 new lifecycle event types |
| `app/api/platform/growth/ai-os/revenue-director/decisions/*` | GET ledger + operator accept/cancel |
| `components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx` | Ledger summary UI |
| `scripts/test-ge-ai-3b-revenue-director-decision-ledger.ts` | Certification |

## Tests Run

```bash
pnpm test:ge-ai-3b-revenue-director-decision-ledger
pnpm test:ge-ai-3a-revenue-director-foundation
```

## Remaining Risks

- Migration not applied in production — ledger sync degrades to empty read model until schema is ready
- Accept records intent only — GE-AI-3C must wire Workflow Agent dispatch with separate idempotency guards
- Snapshot hash hour-bucket may supersede decisions within the same hour when request set changes — acceptable for advisory phase
- No cross-org operator audit export yet

## GE-AI-3C Active Orchestration

**Unblocked for implementation planning.** Persistent decisions, workflow requests, idempotency keys, lifecycle events, and operator accept path are in place. GE-AI-3C can add dispatch behind accept with existing Workflow Agent transports without duplicating orchestration engines.
