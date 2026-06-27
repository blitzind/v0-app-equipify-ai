# GE-AI-3D-PROD-2 — Operator-Gated Adaptive Calibration

**Phase:** GE-AI-3D-PROD-2  
**Status:** Complete locally (not committed / not deployed)  
**QA marker:** `growth-ge-ai-3d-prod-2-adaptive-calibration-v1`

---

## Objective

Convert durable closed-loop learning insights into **operator-gated calibration proposals**. Operators may review, approve, reject, or expire proposals. **Nothing applies automatically** in this phase.

---

## Calibration target audit

| Target System | Current Config Location | Mutable Today? | Risk Level | Calibration Strategy |
| ------------- | ----------------------- | -------------- | ---------- | -------------------- |
| Meta-Recommender ranking | `lib/growth/aios/recommendations/growth-meta-recommender-engine.ts` — formula in `growth-meta-recommender-types.ts` | No (read-only projection) | Medium | Future `adjust_weight` on impact/urgency/confidence/effort coefficients after operator approval |
| Communication Engine ranking | `lib/growth/aios/communication/growth-communication-engine-types.ts` — channel score formula | No (read-only plans) | High | `adjust_weight` / `test_variant` on channel engagement weights; low sample → `monitor_only` |
| Priority Engine binding | `lib/growth/aios/priority/growth-priority-engine-binding-engine.ts` | No (read-only binding) | Medium | `increase_priority` / `decrease_priority` on binding urgency hints |
| Qualification scoring | `lib/growth/apollo/apollo-enrollment-qualification-engine.ts`, `apollo-qualification-scoring-context.ts` | No automatic mutation via AI OS | High | `human_review` / `monitor_only` until controlled apply phase |
| Research scoring | `lib/growth/apollo/apollo-content-quality/*`, research utilization evaluators | No | Medium | Advisory `monitor_only` / `human_review` |
| ICP scoring / ICP builder | `lib/growth/lead-engine/icp-targeting-types.ts` — `fit_scoring_weights` | Operator/LLM parse only; not AI OS auto-mutate | **High** | **Blocked** — proposals may recommend review; no ICP table writes |
| Campaign optimization | `lib/growth/campaign-readiness/campaign-readiness-engine.ts` — `DIMENSION_WEIGHTS` | No | Medium | `test_variant` proposals only |
| Sequence learning / experiments | `lib/growth/sequences/sequence-health.ts`, sequence preview certification | No auto mutation | Medium | `monitor_only` / `human_review` |
| Forecast scoring | Revenue Director KPI projections (`growth-revenue-director-engine.ts`) | No | Low | Advisory context only |
| Relationship scoring | `lib/growth/revenue-workflow/opportunity-recommendation-engine.ts` — `SIGNAL_WEIGHTS` | No | Medium | Future weight proposals; no auto apply |
| Growth Autonomy policy / budgets | `lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service.ts` | Operator-only mutations | **High** | **Blocked** — calibration never mutates autonomy in this phase |
| Settings / config tables | Various org settings via Growth settings APIs | Operator/admin only | High | Proposals reference keys; apply deferred |
| Human Approval Center | `lib/growth/aios/approvals/growth-human-approval-center-engine.ts` | N/A (review surface) | Low | Source `adaptive_calibration`, action `review_recommendation` |
| Revenue Director decision ledger | `growth-revenue-director-decision-*` | Operator accept/cancel only | Medium | Consumes calibration advisory; no auto-apply |

**Principle:** Do not duplicate configuration surfaces. Proposals reference existing subsystem keys; controlled apply is a future phase.

---

## Proposal model

Canonical type: `GrowthAdaptiveCalibrationProposal` in `growth-adaptive-calibration-types.ts`.

Lifecycle statuses: `proposed` → `approved` | `rejected` | `expired` | `superseded`. Status `applied` exists for future phases but **no apply route** is implemented.

Idempotency key: `calibration-proposal:{organizationId}:{sourceInsightId}`.

---

## Migration summary

File: `supabase/migrations/20271001240000_growth_ai_3d_prod_2_adaptive_calibration.sql`

| Table | Purpose |
| ----- | ------- |
| `growth.adaptive_calibration_proposals` | Durable proposals with org scope, idempotency, review metadata |
| `growth.adaptive_calibration_events` | Append-only audit trail |

RLS: **service_role only**. Not applied to production in this phase.

---

## Guardrails

Defined in `GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS`:

- Max weight delta: **0.15**
- Weight bounds: **0.05 – 0.95**
- Min sample for weight change: **3** (below → `monitor_only`, blocked by validator)

Engine clamps deltas; service skips proposals failing validation.

---

## Approval workflow

1. Command Center fetch loads closed-loop learning insights.
2. `syncAdaptiveCalibrationProposalsFromInsights` generates and idempotently persists proposals.
3. Human Approval Center lists `proposed` items (`source: adaptive_calibration`, `actionType: review_recommendation`).
4. Operator POST:
   - `/api/platform/growth/ai-os/adaptive-calibration/[id]/approve`
   - `/api/platform/growth/ai-os/adaptive-calibration/[id]/reject`
5. Approve/reject updates status + append-only events + event bus lifecycle events.
6. **`applied: false` always** — no ranking/scoring/ICP/autonomy mutation.

---

## Non-apply boundary

**Not allowed in GE-AI-3D-PROD-2:**

- Applying proposals to live ranking/scoring systems
- Growth Autonomy policy mutation
- Communication / meta-recommender weight writes
- ICP or Core mutation
- Outbound execution

---

## Integrations

| Surface | Behavior |
| ------- | -------- |
| AI Operations dashboard | Read-only Adaptive Calibration section (no Apply button) |
| Human Approval Center | Calibration review items for proposed proposals |
| Revenue Director | `calibrationAdvisory` + optional recommendation fan-out (advisory only) |
| Event bus | `growth.adaptive_calibration.proposal_*` registered in `ai-event-registry.ts` |

---

## Files changed

| Path | Role |
| ---- | ---- |
| `supabase/migrations/20271001240000_growth_ai_3d_prod_2_adaptive_calibration.sql` | Schema |
| `lib/growth/aios/learning/growth-adaptive-calibration-*.ts` | Types, engine, repository, schema health, service |
| `lib/growth/aios/ai-os-command-center-service.ts` | Sync + read model mount |
| `lib/growth/aios/ai-os-command-center-types.ts` | `adaptiveCalibration` on read model |
| `lib/growth/aios/approvals/growth-human-approval-center-*` | HAC source + collector |
| `lib/growth/aios/revenue-director/growth-revenue-director-types.ts` | `calibrationAdvisory` |
| `lib/growth/aios/ai-event-registry.ts` | Lifecycle event types |
| `app/api/platform/growth/ai-os/adaptive-calibration/**` | GET + approve + reject |
| `components/growth/ai-os/command-center/growth-ai-os-adaptive-calibration-section.tsx` | UI |
| `components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx` | Section mount |
| `scripts/test-ge-ai-3d-prod-2-operator-gated-adaptive-calibration.ts` | Certification |

---

## Tests run

```bash
pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration
```

Includes regression: 3D-PROD-1, 3D, 3C-PROD-1, 3C, 3B, 3A, 2K, 2B.

---

## Remaining risks

- Migration not applied in production — proposals persist only after migration + service_role access.
- No expiry job yet — `expired` status exists but TTL enforcement is manual/future.
- Controlled apply phase must re-audit each target system before enabling writes.

---

## Controlled apply readiness

**Not unblocked.** Operator approval records intent only. A future **GE-AI-3D-PROD-3** (or similar) phase is required for gated apply with per-system adapters, rollback, and additional certification.
