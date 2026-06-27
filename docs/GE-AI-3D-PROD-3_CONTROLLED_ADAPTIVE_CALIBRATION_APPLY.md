# GE-AI-3D-PROD-3 — Controlled Adaptive Calibration Apply

**Phase:** GE-AI-3D-PROD-3  
**Status:** Complete locally (not committed / not deployed)  
**QA marker:** `growth-ge-ai-3d-prod-3-calibration-apply-v1`

---

## Configuration audit

| Target | Current Storage | Versioned? | Rollback? | Safe to Apply? |
| ------ | --------------- | ---------- | --------- | -------------- |
| Communication Engine ranking | Code defaults + `growth.calibration_active_config` overlay | Yes (`calibration_config_versions`) | Yes (rollback token) | Yes |
| Meta-Recommender coefficients | Code defaults + overlay | Yes | Yes | Yes |
| Priority Engine meta multiplier | Code defaults + overlay | Yes | Yes | Yes |
| Research scoring weights | Code defaults + overlay | Yes | Yes | Yes |
| Qualification scoring weights | Code defaults + overlay | Yes | Yes | Yes |
| Forecast weighting | Code defaults + overlay | Yes | Yes | Yes |
| Campaign recommendation weights | Code defaults + overlay | Yes | Yes | Yes |
| Growth Autonomy | Separate policy engine | N/A | N/A | **Blocked** |
| ICP / Core / transport / scheduler | Various — not calibration overlay | N/A | N/A | **Blocked** |

Single overlay store (`calibration_active_config`) — no duplicate per-subsystem config tables.

---

## Apply flow

1. Operator approves proposal (PROD-2)
2. Proposal appears as **Ready to Apply** in Human Approval Center
3. Operator POST `/api/platform/growth/ai-os/adaptive-calibration/[id]/apply`
4. Validation (approved status, allowed target, guardrails)
5. Snapshot before + after persisted as immutable version
6. Active config overlay updated
7. Event bus: `version_created`, `calibration_applied`
8. Rollback token returned

**Approval ≠ Apply** — two explicit operator actions.

---

## Rollback architecture

- POST `/api/platform/growth/ai-os/adaptive-calibration/rollback/[rollbackToken]`
- Restores `config_snapshot_before` from source version
- Creates new immutable rollback version (append-only history)
- Marks source version `rolled_back`
- Publishes `calibration_rolled_back`

---

## Versioning model

`GrowthCalibrationAppliedVersion` includes:

- `proposalId`, `configSnapshotBefore`, `configSnapshotAfter`
- `appliedByUserId`, `appliedAt`, `rollbackToken`
- `previousVersionId`, `versionNumber`, `eventCorrelationId`

Tables: `calibration_config_versions`, `calibration_active_config`, `calibration_config_events`

Migration: `20271001250000_growth_ai_3d_prod_3_calibration_apply.sql` (not applied to production)

---

## Files changed

| Path | Role |
| ---- | ---- |
| `supabase/migrations/20271001250000_growth_ai_3d_prod_3_calibration_apply.sql` | Schema |
| `lib/growth/aios/learning/growth-adaptive-calibration-apply-*.ts` | Types, engine, service, repository, resolver |
| `lib/growth/aios/learning/growth-adaptive-calibration-config-registry.ts` | Default weights |
| `app/api/platform/growth/ai-os/adaptive-calibration/[id]/apply/route.ts` | Apply API |
| `app/api/platform/growth/ai-os/adaptive-calibration/rollback/[rollbackToken]/route.ts` | Rollback API |
| Ranking engines (communication, meta, priority) | Read calibration overlay |
| HAC + UI + Revenue Director | Ready-to-apply + version advisory |

---

## Tests

```bash
pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply
pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration
```

Static certification only — no nested regression chain in cert scripts.

---

## Remaining risks

- Production migration not applied — apply/rollback requires durable tables
- Overlay affects ranking read models only; no automatic retraining or code mutation
- Expiry job for proposals not implemented
- Full autonomous optimization still requires broader ops certification

---

## Autonomous optimization production-ready?

**No.** Controlled configuration apply is implemented with versioning and rollback, but autonomous optimization (unsupervised multi-system tuning, production rollout, live DB) is **not** production-ready until migration deploy, live DB certification, and operator runbooks are complete.
