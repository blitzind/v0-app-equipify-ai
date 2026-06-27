# GE-AI-2I-PROD-3 — Gated Operator Activation Surface

**Phase:** GE-AI-2I-PROD-3  
**Status:** Complete locally (not committed)  
**Cert:** `pnpm test:ge-ai-2i-prod-3-gated-operator-activation`  
**Live smoke (post-migration):** `pnpm test:ge-ai-2i-prod-3-live-db-smoke`

---

## Objective

Provide a gated operator activation surface for persistent autonomous outbound scopes. Authorized Growth operators can activate an already-approved scope only after `activateAutonomousOutboundScopeWithValidation` passes all gates. No scheduler, no send, no sequence job auto-approval.

---

## Operator mutation audit

| Pattern | File(s) | Auth/RBAC | Audit/Event | Reuse Strategy |
| ------- | ------- | --------- | ----------- | -------------- |
| Growth platform GET read | `ai-os/bounded-autonomous-outbound/route.ts` | `requireGrowthEnginePlatformAccess` | Read model only | **Extend** — keep GET-only |
| Growth operator POST | `sequences/execution/jobs/[jobId]/approve/route.ts` | `requireGrowthEnginePlatformAccess` | Sequence job approval | **Parallel** — separate from scope activation |
| Automation approve | `automation/approvals/[approvalId]/approve/route.ts` | `requireAutomationPlatformAccess` | Automation service | Do not duplicate |
| Execution plan review POST | `ai-os/execution-plan-review/[leadId]/action/route.ts` | `requireGrowthEnginePlatformAccess` | Review service | Pattern for POST + org guard |
| AI OS approvals GET | `ai-os/approvals/route.ts` | `requireGrowthEnginePlatformAccess` | Read-only inbox | **Extend** UI on same page |
| Scope activation POST | `bounded-autonomous-outbound/scopes/[scopeId]/activate/route.ts` | **`requireGrowthOperatorAccess`** | `activateAutonomousOutboundScopeWithValidation` + event bus | **New** — minimal gated mutation |
| Service-role persistence | `growth-autonomous-outbound-scope-repository.ts` | Server-only via API | Scope events table + AI OS bus | **Reuse** PROD-1 |

---

## Activation route design

**POST** `/api/platform/growth/ai-os/bounded-autonomous-outbound/scopes/[scopeId]/activate`

| Check | Implementation |
| ----- | -------------- |
| Auth | `requireGrowthOperatorAccess` (operator / manager / platform admin) |
| Organization | `getGrowthEngineAiOrgId()` |
| Validation | `submitOperatorAutonomousOutboundScopeActivation` → `activateAutonomousOutboundScopeWithValidation` |
| Schema | Fail closed 503 when tables missing |
| Send | Never — `sendOccurred: false` in response |
| Sequence jobs | Never auto-approved — `sequenceJobApprovalRequired: true` |

**GET** `/api/platform/growth/ai-os/bounded-autonomous-outbound` — unchanged read-only eligibility/read model.

---

## UI behavior

**Human Approval Center** (`/growth/os/approvals`):

- Shows `GrowthAutonomousOutboundScopeActivationControl` for `autonomous_outbound_scope` items with status `approved_elsewhere`
- Button disabled when `evaluateAutonomousOutboundActivationEligibility` fails
- Confirmation modal shows source, channels, audience size, limits, expiration, stop conditions
- Displays `GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING`

**AI Operations / Command Center** — remain read-only (no POST). Link to Approval Center for activation.

---

## Dual-approval warning

> Scope activation authorizes the bounded envelope only. Sequence jobs still require separate human approval before any send.

Operators must still approve sequence jobs via existing `/api/platform/growth/sequences/execution/jobs/[jobId]/approve`.

---

## Option C provenance design (audit-only, not implemented)

Future sequence jobs may record metadata without auto-approval:

```json
{
  "scope_authorized": {
    "parent_scope_id": "uuid",
    "scope_approval_source": "human_approval_center",
    "scope_approved_by_user_id": "uuid",
    "scope_approved_at": "iso",
    "allowed_channels": ["email", "sms"],
    "operator_id": "uuid",
    "recorded_at": "iso"
  }
}
```

Transport still requires existing `humanApprovedAt` on the job. Provenance is for audit and operator clarity only.

---

## Live DB smoke instructions

Default **dry-run** (no writes):

```bash
pnpm test:ge-ai-2i-prod-3-live-db-smoke
```

After migration apply, explicit live mode:

```bash
GROWTH_AUTONOMOUS_OUTBOUND_LIVE_DB_SMOKE=1 \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
GROWTH_ENGINE_AI_ORG_ID=... \
pnpm test:ge-ai-2i-prod-3-live-db-smoke
```

Verifies: schema ready → draft → approve → activate (or autonomy block) → blocked action → idempotency → expire cleanup. No send.

---

## Files changed

| File | Change |
| ---- | ------ |
| `app/api/platform/growth/ai-os/bounded-autonomous-outbound/scopes/[scopeId]/activate/route.ts` | Gated POST |
| `lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service.ts` | Operator submission wrapper |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts` | PROD-3 constants |
| `lib/growth/aios/approvals/growth-human-approval-center-engine.ts` | Scope ID + activation evidence |
| `components/growth/ai-os/approvals/growth-autonomous-outbound-scope-activation-control.tsx` | Activation UI |
| `components/growth/ai-os/approvals/growth-human-approval-center-panel.tsx` | Wired control |
| `scripts/test-ge-ai-2i-prod-3-gated-operator-activation.ts` | Certification |
| `scripts/test-ge-ai-2i-prod-3-live-db-smoke.ts` | Live smoke harness |
| `package.json` | Cert scripts |

---

## Tests run

```bash
pnpm test:ge-ai-2i-prod-3-gated-operator-activation
pnpm test:ge-ai-2i-prod-3-live-db-smoke
```

Includes PROD-2, PROD-1, 2I, 2B, 2H, 2E, 2F regressions.

---

## Remaining risks

| Risk | Mitigation |
| ---- | ---------- |
| Growth Autonomy kill switch blocks activation in prod | Operator runbook + eligibility UI |
| Dual approval operator confusion | Modal warning + runbook |
| Live DB smoke not run until migration | Run smoke after apply |
| No scope_authorized provenance yet | Option C future phase |

---

## Production rollout checklist

- [ ] Apply PROD-1 migration on staging/production
- [ ] Run `pnpm test:ge-ai-2i-prod-3-live-db-smoke` with `LIVE_DB_SMOKE=1`
- [ ] Verify operator role can activate; viewer cannot
- [ ] Confirm sequence job still requires separate approval before send
- [ ] Document operator workflow in runbook
- [ ] Batch commit GE-AI-2I + PROD-1/2/3 bundle

---

## Production readiness

**Operator activation surface certified locally.** Ready for release bundle with migration apply and live smoke. Autonomous outbound at scale still requires operator runbook adoption and optional Option C provenance phase.
