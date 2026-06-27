# GE-AI-2I-PROD-2 — Autonomous Outbound Production Integration Certification

**Phase:** GE-AI-2I-PROD-2  
**Status:** Complete locally (not committed)  
**Dependencies:** GE-AI-2I, GE-AI-2I-PROD-1  
**Cert command:** `pnpm test:ge-ai-2i-prod-2-autonomous-outbound-integration`

---

## Objective

Certify autonomous outbound persistence and orchestration in a production-like integration path before any release bundle — without applying production migrations, enabling schedulers, or expanding autonomy permissions.

---

## Production readiness audit

| Area | Current State | Production Risk | Required Before Release |
| ---- | ------------- | --------------- | ----------------------- |
| Migration SQL | Three growth tables, indexes, RLS, triggers, idempotency index | Migration not applied to prod DB | Apply `20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql` in release bundle |
| Repository | Service-role PostgREST access, row mappers, upsert/idempotency | Untested against live PostgREST | Post-migration smoke: insert scope + action round-trip |
| Schema health | Graceful empty read model when tables missing | Ops sees empty scopes until migration | Verify `probeGrowthAutonomousOutboundScopeSchema` → `ready: true` after migration |
| Action idempotency | Unique `(organization_id, idempotency_key)` | Duplicate sends on retry | Confirmed in harness; re-verify on live DB |
| Event bus | Dual publish: scope events table + `publishGrowthAiEvent` | Bus failure is non-blocking (by design) | Monitor AI OS event deliveries in ops |
| Activation validation | Human approval, expiration, audience, limits, channels, Growth Autonomy | Kill switch defaults may block activation | Operator runbook for activation prerequisites |
| Sequence job approval | **Dual approval** — scope + per-job `humanApprovedAt` | Operators approve twice; autonomous tick may fail with `job_not_approved` | Document workflow; see alignment recommendation |
| Sequence runtime | Email/SMS/voice drop via `runSequenceExecutionJob` | Transport gates still authoritative | No bypass — scope does not replace job approval today |
| SMS live send | Blocked when `senderReady: false` in gate matrix | SMS may block even with active scope | Confirm Twilio/readiness before scope activation |
| Voice drop | `VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED` + certification flag | Voice drop blocked by default | Explicit certification + scope flag required |
| AI Voice | Blocked unless `aiVoiceExplicitlyApproved` on scope | No accidental dial | Gate certified |
| Operator UI | Read-only scope panel + activation eligibility badge | No ungated activation button | Keep read-only until PROD-3 activation route |
| Scheduler/cron | Not enabled in orchestrator | N/A | Do not add cron in release bundle |

---

## Integration cert matrix

| # | Requirement | Verification method |
| - | ----------- | ------------------- |
| 1 | Migration SQL complete | Static SQL audit |
| 2 | Schema health detects missing tables | Missing-schema harness |
| 3–6 | Scope lifecycle + idempotency + events | In-memory repository harness |
| 7 | Event bus lifecycle events | Registry + orchestrator static audit |
| 8–12 | Activation validation failures | Harness + gate matrix |
| 13–19 | Channel transport delegation / blocks | Gate matrix + transport path constants |
| 20–25 | Caps, stop, suppression, opt-out | Gate matrix deterministic tests |
| 26 | No Core mutations | Static forbidden-token audit |
| 27 | No scheduler/cron | Static orchestrator audit |
| 28–29 | Regressions | PROD-1, 2I, 2B, 2H, 2E, 2F, PROD-REGRESSION-6 |

---

## Sequence approval alignment

### Current behavior

1. **Scope approval** (`GrowthAutonomousOutboundScope.status = approved`) authorizes a bounded execution envelope: audience, channels, limits, stop conditions.
2. **Sequence job approval** remains independent. `runSequenceExecutionJob` requires:
   - `job.status === "approved"`
   - `job.humanApprovedAt` + `job.humanApprovedBy` when `requiresHumanApproval`
   - Run request with `humanApproved=true`, `humanApprovalConfirmed=true`, `approvedBy`
3. The bounded orchestrator passes `humanApproved: true` and `approvedBy: scope.approvedByUserId`, but **does not auto-approve pending sequence jobs**.

### Duplicate approval impact

Operators who approve a scope must still approve individual sequence jobs (via existing Approval Center / sequence approval flows) before autonomous execution can dispatch transport. This is **intentional friction** for initial production.

### Recommendation: **Option A — Keep dual approval**

For the first production release bundle:

- Treat scope approval as the **parent authorization envelope**
- Require existing sequence job approval as the **child transport gate**
- Document clearly in operator runbook

**Future (Option C):** Introduce `scope_authorized` provenance on sequence jobs that records parent scope id and approver — **without** auto-send. Child jobs still pass full transport gates; provenance is audit-only until harmonization is certified.

**Do not implement Option B** (auto-mark child jobs approved from scope) in the initial release — it reduces safety and bypasses per-step sequence review.

---

## Migration readiness checklist

**Do not apply until release bundle is approved.**

- [ ] Migration file reviewed: `20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql`
- [ ] Staging apply + rollback script prepared
- [ ] Post-apply schema health: `probeGrowthAutonomousOutboundScopeSchema` → `ready: true`
- [ ] Expected objects:
  - `growth.autonomous_outbound_scopes`
  - `growth.autonomous_outbound_scope_actions`
  - `growth.autonomous_outbound_scope_events`
  - Indexes: org/status, org/source, idempotency unique partial
  - RLS policies: service_role only
- [ ] Smoke (post-migration, service role):
  - Insert draft scope → approve → activate → record blocked action → verify idempotency
- [ ] Rollback: drop three tables (no Core dependencies)

### Production smoke commands (after migration apply)

```bash
pnpm test:ge-ai-2i-prod-2-autonomous-outbound-integration
pnpm test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes
pnpm test:ge-ai-2i-bounded-autonomous-outbound
```

---

## Operator activation notes

- **Read-only indicators** in Command Center show:
  - Scope status, budget consumption, expiration, channels
  - **Eligible for activation** badge when all scope-side checks + kill switch pass
  - Ineligibility reasons (read-only text)
- **Activation** must go through `activateAutonomousOutboundScopeWithValidation` (service layer) — not exposed as ungated UI mutation in this phase
- **Approval Center** link remains authoritative for scope source approval
- Kill switch state displayed; outbound off blocks eligibility

---

## Files changed

| File | Change |
| ---- | ------ |
| `scripts/growth-autonomous-outbound-integration-harness.ts` | In-memory Supabase harness |
| `scripts/test-ge-ai-2i-prod-2-autonomous-outbound-integration.ts` | Integration cert |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine.ts` | `evaluateAutonomousOutboundActivationEligibility` |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts` | PROD-2 phase constant |
| `components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section.tsx` | Activation eligibility UI |
| `package.json` | Cert script |
| `docs/GE-AI-2I-PROD-2_AUTONOMOUS_OUTBOUND_INTEGRATION_CERTIFICATION.md` | This doc |

---

## Tests run

```bash
pnpm test:ge-ai-2i-prod-2-autonomous-outbound-integration
```

Includes regressions: PROD-1, 2I, 2B, 2H, 2E, 2F, PROD-REGRESSION-6.

---

## Remaining risks

| Risk | Mitigation |
| ---- | ---------- |
| Live DB not yet certified | Apply migration in controlled release; run smoke |
| Dual approval operator confusion | Runbook + Approval Center UX copy |
| Stop conditions manual only | GE-AI-2J+ reply intelligence |
| No gated activation UI route | PROD-3 operator activation surface |

---

## Release bundle recommendation

Include in first autonomous outbound release bundle:

1. `20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql`
2. All `lib/growth/aios/outbound/` persistence + orchestrator files from GE-AI-2I + PROD-1 + PROD-2
3. Command Center / Approval Center read model integrations
4. Operator runbook section on dual approval
5. Cert scripts PROD-1 + PROD-2 + 2I as CI gate

**Exclude:** scheduler activation, ungated activation API, Option B sequence auto-approval.

---

## Production readiness verdict

**Integration certified locally — ready for batched release prep, not live autonomous outbound at scale.**

Persistence and gate behavior are proven deterministically. Production rollout requires migration apply + live smoke + operator runbook.

---

## Next recommended phase

**GE-AI-2I-PROD-3** — Gated operator activation surface: read/prepare activation route wrapping `activateAutonomousOutboundScopeWithValidation`, live DB smoke harness, and optional `scope_authorized` provenance audit (Option C design only).
