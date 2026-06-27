# GE-AI-SHIP-0 — Local Release Bundle Audit

**Phase:** GE-AI-SHIP-0  
**Status:** Audit complete (local only — nothing committed, deployed, or migrated)  
**Date:** 2026-06-25  
**QA marker:** `ge-ai-ship-0-local-release-bundle-audit-v1`

---

## Executive summary

This bundle is a **large, uncommitted local-only AI Revenue OS release** spanning architecture docs, read-model foundations, operator-gated mutations (Revenue Director dispatch, bounded autonomous outbound activation, adaptive calibration approve/apply/rollback), and five new Growth-schema migrations. **Nothing is production-ready until migrations are applied and focused/live certifications pass.**

**Recommendation: B — Split into smaller release bundles** (see §8). Do **not** ship the entire monolith in one push to `main`.

**Certs run during this audit (PASS):**
- `pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply`
- `pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration`
- `pnpm test:prod-regression-6-command-center-import-stability`

**Certs deferred** (invoke long nested regression chains — not run in this audit):
- `pnpm test:ge-ai-3d-prod-1-durable-closed-loop-learning-store` → chains to 3D → 3C-PROD-1 → …
- `pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation` → chains to 3C → 3B → 3A → …
- `pnpm test:ge-ai-2i-prod-3-gated-operator-activation` → chains + live DB smoke

---

## 1. Git / file audit

### Summary

| Metric | Value |
|--------|-------|
| Modified tracked files | 23 |
| Untracked new files/dirs | ~90+ (lib, API, UI, migrations, scripts, docs) |
| Lines changed (tracked diff) | +1,334 / −126 |
| Commits | **None** (entire bundle local) |
| Production migrations applied | **None** |

### Changed files by phase

| Phase | Files Changed | Risk Level | Notes |
| ----- | ------------- | ---------- | ----- |
| **GE-AIOS-ARCH-1A** | 1 doc | Low | Architecture consolidation only (`docs/GE-AIOS-ARCH-1A_*.md`) |
| **PROD-REGRESSION-6** | 3 modified + 1 script | Low | Command center import stability; AI Operations read-only verified |
| **GE-AI-2B Event Bus** | `lib/growth/aios/event-bus/` (new), `ai-event-*` (mod), script, doc | Low | Event registry/subscriber wiring; no transport |
| **GE-AI-2E Priority Binding** | `lib/growth/aios/priority/` (new), objectives UI/API, script, doc | Low–Med | Read + binding API; no outbound |
| **GE-AI-2F Meta-Recommender** | `lib/growth/aios/recommendations/` (new), UI section, script, doc | Low | Advisory read model; calibration overlay in PROD-3 |
| **GE-AI-2H Human Approval Center** | `approvals/` lib+UI+API, HAC panel, script, doc | Med | Approve/reject surfaces; gates before outbound |
| **GE-AI-2I Bounded Autonomous Outbound** | `lib/growth/aios/outbound/` (new), bounded API, UI section, scripts (2I + PROD-1/2/3), doc | **High** | Operator-gated activation; channel caps; transport adapters |
| **GE-AI-2K Communication Engine** | `lib/growth/aios/communication/` (new), API, UI, script, doc | Med | Planning read model; uses calibration overlay |
| **GE-AI-3A Revenue Director Foundation** | `lib/growth/aios/revenue-director/` (partial), script, doc | Low | Read model foundation |
| **GE-AI-3B Decision Ledger** | revenue-director lib, API routes, migration `20271001220000`, script, doc | Med | Durable decisions; org-scoped Growth schema |
| **GE-AI-3C Active Orchestration** | dispatch service/types, script, doc | Med | Workflow dispatch — not direct send |
| **GE-AI-3C-PROD-1 Dispatch Completion** | dispatch correlation wiring, script, doc | Med | Correlates dispatch → completion events |
| **GE-AI-3D Closed-Loop Learning** | `lib/growth/aios/learning/` (partial), script, doc | Med | In-memory + durable paths |
| **GE-AI-3D-PROD-1 Durable Learning Store** | migration `20271001230000`, repository, script, doc | Med | Requires migration before durable writes |
| **GE-AI-3D-PROD-2 Adaptive Calibration** | migration `20271001240000`, approve/reject API, HAC, UI, script, doc | Med | Operator approve/reject only |
| **GE-AI-3D-PROD-3 Calibration Apply** | migration `20271001250000`, apply/rollback API, config resolver, script, doc | Med | Operator apply + rollback token |
| **Cross-cutting integration** | `ai-os-command-center-service.ts`, command center/operations UI, `package.json`, ledger, master context | Med | Wires all sections into read model |

### Prior committed migrations (already in repo)

These support earlier AIOS foundations and are **already tracked** (not part of this bundle's new migration set):

`20271001120000` … `20271001200000` (2A–3A provider adapters)

### New untracked migrations (this bundle)

See §2.

---

## 2. Migration audit

### Migration order (apply sequentially)

| Order | Migration | Phase |
|-------|-----------|-------|
| 1 | `20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql` | GE-AI-2I-PROD-1 |
| 2 | `20271001220000_growth_ai_3b_revenue_director_decision_ledger.sql` | GE-AI-3B |
| 3 | `20271001230000_growth_ai_3d_prod_1_closed_loop_learning_store.sql` | GE-AI-3D-PROD-1 |
| 4 | `20271001240000_growth_ai_3d_prod_2_adaptive_calibration.sql` | GE-AI-3D-PROD-2 |
| 5 | `20271001250000_growth_ai_3d_prod_3_calibration_apply.sql` | GE-AI-3D-PROD-3 |

### Per-migration detail

| Migration | Tables | RLS | Rollback Complexity | Required Before Feature Works |
| --------- | ------ | --- | ------------------- | ----------------------------- |
| `20271001210000` | `growth.autonomous_outbound_scopes`, `autonomous_outbound_scope_actions`, `autonomous_outbound_scope_events` | Enabled; service_role policies only | Medium — drop 3 tables; scopes may hold active pilot data | Persistent scope storage, operator activation, PROD-2/3 outbound cert |
| `20271001220000` | `growth.revenue_director_decisions`, `revenue_director_workflow_requests`, `revenue_director_decision_events` | Enabled; service_role only | Medium — drop 3 tables | Revenue Director ledger, dispatch, completion correlation |
| `20271001230000` | `growth.closed_loop_learning_outcomes`, `closed_loop_learning_insights`, `closed_loop_learning_events` | Enabled; service_role only | Medium — drop 3 tables; insights feed calibration | Durable learning store (fallback: in-memory via `GROWTH_LEARNING_IN_MEMORY_STORE=1`) |
| `20271001240000` | `growth.adaptive_calibration_proposals`, `adaptive_calibration_events` | Enabled; service_role only | Low–Med — drop 2 tables | Operator-gated calibration approve/reject |
| `20271001250000` | `growth.calibration_config_versions`, `calibration_active_config`, `calibration_config_events` | Enabled; service_role only | Low — rollback via API token restores overlay | Controlled calibration apply/rollback |

### Core table verification

- All five migrations reference **`public.organizations`** only (FK for `organization_id`).
- **No Core table mutations** (work orders, scheduling, invoicing, etc.).
- All new tables live in **`growth`** schema with RLS + service_role policies (server-side access only).

---

## 3. Runtime / env audit

| Env / Setting | Required? | Default Behavior | Risk |
| ------------- | --------- | ---------------- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (existing) | Standard Supabase | Low |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (existing) | Standard Supabase | Low |
| `GROWTH_ENGINE_AI_ORG_ID` (or equivalent org config) | Yes (existing) | Routes return `growth_engine_ai_org_not_configured` without it | Low |
| `GROWTH_LEARNING_IN_MEMORY_STORE=1` | **No** (test only) | When set, learning uses in-memory store instead of DB | Low — must **not** set in production |
| `GROWTH_CALIBRATION_IN_MEMORY_STORE=1` | **No** (test only) | When set, calibration overlay uses in-memory store | Low — must **not** set in production |
| Growth Autonomy control plane | Existing | Unchanged path `/growth/settings/autonomy`; `schedulerActive: false` in policy synthesizer | Low if defaults preserved |
| Scheduler activation | N/A | **Not enabled** — UI shows readiness only; no scheduler toggle added | Low |
| Voice / Voice Drop / AI Voice | Existing transport | Blocked without explicit scope flags + certification gates | Med if misconfigured |
| LinkedIn | Manual-only | `linkedin_manual` channel creates tasks; no automation | Low |
| `.env.local` | **Never use** | Not referenced in AI OS lib code | — |

**Confirmed:**
- No `.env.local` usage in `lib/growth/aios/**`
- No new **required** production env vars beyond existing Growth Engine config
- No new external provider dependencies introduced by this bundle
- Growth Autonomy defaults unchanged (`GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH` preserved per PROD-REGRESSION-6)

---

## 4. API route audit

All routes under `/api/platform/growth/ai-os/` require Growth Engine platform or operator access. **32 route files** total.

### GET read-only

| Route | Auth |
|-------|------|
| `/command-center` | `requireGrowthEnginePlatformAccess` |
| `/revenue-director` | platform |
| `/revenue-director/decisions` | platform |
| `/recommendations` | platform |
| `/priority-bindings` | platform |
| `/communication-plan` | platform |
| `/bounded-autonomous-outbound` | platform |
| `/adaptive-calibration` | platform |
| `/approvals` | platform |
| `/execution-runtime` | platform |
| `/missions/[missionId]/planning` | platform |
| `/missions/[missionId]/planning/preview` | platform |
| `/pilot/lead-research/[leadId]` | platform |

### POST — gated operator mutation

| Route | Auth | Notes |
|-------|------|-------|
| `/revenue-director/decisions/[id]/accept` | **operator** | Accept decision |
| `/revenue-director/decisions/[id]/cancel` | **operator** | Cancel decision |
| `/revenue-director/workflow-requests/[id]/dispatch` | **operator** | Dispatches to Workflow Agent — **not direct outbound send** |
| `/bounded-autonomous-outbound/scopes/[scopeId]/activate` | **operator** | Dual-approval gated activation |
| `/adaptive-calibration/[id]/approve` | **operator** | Approve proposal |
| `/adaptive-calibration/[id]/reject` | **operator** | Reject proposal |
| `/adaptive-calibration/[id]/apply` | **operator** | Apply approved calibration (`autonomyMutated: false`) |
| `/adaptive-calibration/rollback/[rollbackToken]` | **operator** | Rollback calibration version |

### POST — platform (existing pilots / runtime — blocked or dry-run)

| Route | Auth | Risk if misconfigured |
|-------|------|----------------------|
| `/autonomous-*-pilot/action` (5 routes) | platform | Pilot actions — bounded by autonomy policy |
| `/execution-runtime/enqueue` | platform | Internal workflow enqueue |
| `/execution-runtime/dry-run` | platform | Dry-run only |
| `/execution-runtime/[executionId]/action` | platform | Runtime control |
| `/execution-plan-review/[leadId]/action` | platform | Plan review |
| `/missions/[missionId]/planning/approve` | platform | Mission planning |

### Safety verification

| Check | Status |
|-------|--------|
| Growth auth on all AI OS routes | ✓ |
| Operator RBAC on accept/cancel/dispatch/activate/approve/apply/rollback | ✓ |
| No public mutation routes | ✓ |
| No accidental direct transport send routes | ✓ — dispatch goes to Workflow Agent; outbound uses bounded orchestrator with gates |
| AI Operations command center | GET only (PROD-REGRESSION-6 certified) |

---

## 5. UI audit

### New UI surfaces

| Surface | Location | Mutation? |
|---------|----------|-----------|
| AI Operations Command Center | `/growth/os` | **Read-only** (GET fetch only) |
| Human Approval Center | `/growth/os/approvals` | Approve/reject/activate via gated POST |
| Revenue Director section | Command center | Dispatch button (operator, confirm dialog) |
| Bounded Autonomous Outbound section | Command center | Read-only display; activation in HAC |
| Adaptive Calibration section | Command center | Read-only counts; **no Apply button in UI** |
| Closed-Loop Learning section | Command center | Read-only |
| Communication / Meta / Priority sections | Command center | Read-only |
| Scope activation control | HAC | Operator activate with confirmation |

### Safety verification

| Check | Status |
|-------|--------|
| AI Operations remains read-only | ✓ (PROD-REGRESSION-6) |
| HAC mutation controls only where intended | ✓ |
| Dispatch requires operator + confirm | ✓ |
| Scope activation requires operator + confirm | ✓ |
| Calibration apply API exists; UI does not expose Apply button | ✓ (operator must call API or future UI) |
| No bulk activation UI | ✓ |
| Scheduler shown as inactive/readiness only | ✓ — no scheduler toggle |

---

## 6. Autonomous safety audit

| Control | Implementation | Status |
|---------|----------------|--------|
| Growth Autonomy gates | Policy synthesizer + orchestrator checks | ✓ Unchanged defaults |
| Human approval gates | HAC + dual approval for scope activation | ✓ |
| Bounded outbound scopes | Scope engine with channel/audience/limits | ✓ |
| Persistent scope storage | Migration `20271001210000` | ✓ (not applied prod) |
| Dual approval behavior | `GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING` | ✓ |
| Channel caps | `maxActionsPerDay`, `maxVoiceDropsPerDay` | ✓ |
| Quiet hours | `isWithinScopeQuietHours` gate | ✓ |
| Suppression / opt-out | `isEmailSuppressed` + gate checks | ✓ |
| AI Voice explicit approval | `aiVoiceExplicitlyApproved` scope flag | ✓ Blocked by default |
| Voice drop certification | `voiceDropCertified` + `VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED` | ✓ |
| LinkedIn manual-only | `linkedin_manual` → task creation | ✓ |
| No scheduler activation | `schedulerActive: false` in autonomy policy | ✓ |
| No Core mutations | Growth schema only | ✓ |
| Calibration does not mutate Growth Autonomy | Explicitly blocked in PROD-3 doc | ✓ |

---

## 7. Test matrix

### Per-phase certification scripts

| Phase | Cert command | Nested chain? | When required |
|-------|--------------|---------------|---------------|
| PROD-REGRESSION-6 | `pnpm test:prod-regression-6-command-center-import-stability` | No | **Before commit** |
| GE-AI-2B | `pnpm test:ge-ai-2b-event-bus-completion` | Yes (long) | Before commit (static portion sufficient for gate) |
| GE-AI-2E | `pnpm test:ge-ai-2e-priority-engine-binding` | Yes | Before commit |
| GE-AI-2F | `pnpm test:ge-ai-2f-meta-recommender` | Yes | Before commit |
| GE-AI-2H | `pnpm test:ge-ai-2h-human-approval-center` | Yes | Before commit |
| GE-AI-2I | `pnpm test:ge-ai-2i-bounded-autonomous-outbound` | Yes | Before commit |
| GE-AI-2I-PROD-1 | `pnpm test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes` | Yes | After migration 1 |
| GE-AI-2I-PROD-2 | `pnpm test:ge-ai-2i-prod-2-autonomous-outbound-integration` | Yes | After migration 1 |
| GE-AI-2I-PROD-3 | `pnpm test:ge-ai-2i-prod-3-gated-operator-activation` | Yes + live DB | After migration 1 + deploy |
| GE-AI-2K | `pnpm test:ge-ai-2k-communication-engine` | Yes | Before commit |
| GE-AI-3A | `pnpm test:ge-ai-3a-revenue-director-foundation` | Yes | Before commit |
| GE-AI-3B | `pnpm test:ge-ai-3b-revenue-director-decision-ledger` | Yes | After migration 2 |
| GE-AI-3C | `pnpm test:ge-ai-3c-revenue-director-active-orchestration` | Yes | Before commit |
| GE-AI-3C-PROD-1 | `pnpm test:ge-ai-3c-prod-1-dispatch-completion-correlation` | Yes (long) | After migration 2 |
| GE-AI-3D | `pnpm test:ge-ai-3d-closed-loop-learning-foundation` | Yes | Before commit |
| GE-AI-3D-PROD-1 | `pnpm test:ge-ai-3d-prod-1-durable-closed-loop-learning-store` | Yes (long) | After migration 3 |
| GE-AI-3D-PROD-2 | `pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration` | **No (static)** | **Before commit** ✓ PASS |
| GE-AI-3D-PROD-3 | `pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply` | **No (static)** | **Before commit** ✓ PASS |

### Recommended test chains

**Shortest reliable pre-commit chain (static):**
```bash
pnpm test:prod-regression-6-command-center-import-stability
pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration
pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply
```

**After migration apply (live DB):**
```bash
pnpm test:ge-ai-2i-prod-3-live-db-smoke
# Per-bundle: PROD-1/2/3 outbound, 3B, 3D-PROD-1 static + schema health
```

**Long regression chain (optional / expensive):**
Run each phase cert individually; avoid top-level certs that `execSync` nested suites unless time-budgeted.

**After deploy (production smoke):**
- GET `/api/platform/growth/ai-os/command-center` (authenticated operator)
- GET `/api/platform/growth/ai-os/adaptive-calibration`
- Verify AI Operations page loads without 500
- Verify no outbound sent without activated scope

---

## 8. Release bundle recommendation

### **B — Split into smaller release bundles**

**Why not A (ship entire bundle):**
- Monolithic uncommitted diff (~90+ new files) is hard to review and rollback
- Five migrations with different feature dependencies
- Autonomous outbound (HIGH risk) bundled with read-only foundations (LOW risk)
- Long nested regression chains not fully executed in this audit
- Live DB smoke for outbound scopes not confirmed

**Why not D (do not ship yet):**
- Static certs pass for critical integration points (PROD-REGRESSION-6, PROD-2, PROD-3)
- Safety gates are implemented and verified statically
- Read-only surfaces are safe to deploy without enabling autonomous behavior

### Proposed split

| Bundle | Phases | Migrations | Risk |
|--------|--------|------------|------|
| **B1 — Read foundations** | ARCH-1A, PROD-REGRESSION-6, 2B, 2E, 2F, 2K, 3A (read), command center wiring | None new | Low |
| **B2 — Revenue Director** | 3B, 3C, 3C-PROD-1 | `20271001220000` | Med |
| **B3 — Learning + Calibration** | 3D, 3D-PROD-1, 3D-PROD-2, 3D-PROD-3 | `20271001230000`–`20271001250000` | Med |
| **B4 — HAC + Bounded Outbound** | 2H, 2I, 2I-PROD-1/2/3 | `20271001210000` | **High** — deploy last; pilot only |

**Safe to ship now (after commit + migration):** B1 alone, or B1+B2 with migrations and operator runbook.

**Blocked until live DB cert + pilot plan:** B4 autonomous outbound activation.

---

## 9. Rollout plan

*Do not execute until explicit ship approval.*

1. **Final local tests** — run short static chain (§7); run phase-specific certs for target bundle
2. **Commit** — one commit per proposed bundle (B1→B4)
3. **Push to `main`** — triggers Vercel auto-deploy (never `vercel deploy`)
4. **Apply migrations** — in order (§2); verify via schema health endpoints / cert scripts
5. **Live DB smoke** — `pnpm test:ge-ai-2i-prod-3-live-db-smoke` when B4 included
6. **Production route smoke** — authenticated GETs on command center, approvals, calibration
7. **Operator runbook** — document activation steps, kill switches, monitoring
8. **Tiny live autonomous pilot** — §11 only after B4 + all gates pass

---

## 10. Rollback plan

| Layer | Rollback action |
|-------|-----------------|
| **Git** | Revert commit on `main`; Vercel redeploys previous build |
| **Migrations** | No automatic down migrations — forward-fix or manual DROP of Growth tables if needed; order reverse of §2 |
| **Feature disable** | Do not activate outbound scopes; leave Growth Autonomy budgets at 0 |
| **Growth Autonomy kill switch** | Control plane `/growth/settings/autonomy` — disable autonomous categories |
| **Autonomous outbound disable** | Pause scopes via operator; do not call activate; revoke operator sessions if needed |
| **Calibration overlay rollback** | POST `/api/platform/growth/ai-os/adaptive-calibration/rollback/[rollbackToken]` per applied version |
| **Learning persistence fallback** | Set `GROWTH_LEARNING_IN_MEMORY_STORE=1` only in emergency dev — **not for production**; prefer disabling calibration pipeline |

---

## 11. Live pilot plan

**Objective:** Validate bounded autonomous outbound on a single Growth objective cohort with full gates and monitoring.

| Parameter | Value |
|-----------|-------|
| Cohort | One objective, ≤10 leads |
| Channels | Email + SMS only |
| Caps | `maxActionsPerDay: 5`, `maxVoiceDropsPerDay: 0` |
| AI Voice | **Off** |
| Voice Drop | **Off** |
| LinkedIn | **Off** (no manual tasks in pilot) |
| Scheduler | **Off** |
| Activation | Manual operator via HAC — dual approval required |
| Monitoring | Command center + decision ledger + scope events |
| Stop conditions | Any suppression hit, autonomy block, or unexpected transport → pause scope immediately |
| Duration | 48h max; review before extension |

---

## 12. Remaining blockers

| Blocker | Severity | Resolution |
|---------|----------|------------|
| Nothing committed | High | Commit per bundle B1–B4 |
| Migrations not applied to production | High | Apply in order after deploy |
| Long regression chains not run end-to-end | Med | Run focused certs per bundle before ship |
| `test:ge-ai-2i-prod-3-gated-operator-activation` + live DB smoke not run | High for B4 | Run after migration 1 on staging/prod |
| Autonomous outbound pilot runbook not written | Med | Operator doc before B4 |
| Calibration apply has API but no UI Apply button | Low | Acceptable — operator uses API or defer apply until UI added |
| Feature registry enforcement (8H) still pending | Low | Out of scope for this bundle |

---

## Documentation updated (this phase)

| Document | Action |
|----------|--------|
| `docs/GE-AI-SHIP-0_LOCAL_RELEASE_BUNDLE_AUDIT.md` | Created (this file) |
| `docs/MASTER_CONTEXT_DOCUMENT.md` | Updated — SHIP-0 audit reference |
| `docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md` | Updated — SHIP-0 entry |

---

*GE-AI-SHIP-0 — audit only. No commit, push, deploy, or production migration.*
