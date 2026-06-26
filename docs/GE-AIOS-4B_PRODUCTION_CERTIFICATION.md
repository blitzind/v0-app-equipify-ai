# GE-AIOS-4B — Lead Research Pilot Production Certification

**Phase:** GE-AIOS-4B — Production certification of GE-AIOS-4A only  
**Date:** 2026-06-25  
**Verdict:** **FAIL — blocked on production schema readiness**  
**Policy:** No new code added. No commit / push / deploy.

---

## Executive summary

Local AI OS stack certification (3F) and Lead Research Pilot foundation (4A) both **PASS**. Production Supabase (`byyfylkklbxcdofaspye.supabase.co`) does **not** expose GE-AIOS tables via PostgREST — migrations appear **not applied** (or schema cache not reloaded). Live E2E pilot verification, flag-OFF runtime checks, and provider observation **could not run** until schema is ready.

**Do not enable `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED` in production until this cert is re-run and passes.**

---

## Preconditions

| Precondition | Result | Notes |
|--------------|--------|-------|
| GE-AIOS foundation migrations applied in production | **FAIL** | `growth.ai_work_orders`, `growth.ai_os_events`, `growth.ai_provider_requests` return `PGRST205` (not in schema cache) |
| `pnpm run build` passes | **BLOCKED locally** | `verify-growth-production-runtime` requires `GROWTH_PROVIDER_CREDENTIALS_PEPPER` — absent in pulled env files; Vercel Production likely configured |
| GE-AIOS stack cert passes | **PASS** | `pnpm test:ge-aios-3f-stack-certification-foundation` — 15/15 |
| 4A foundation cert passes | **PASS** | `pnpm test:ge-aios-4a-lead-research-pilot-foundation` |
| `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED` OFF by default | **PASS** | Code: strict `=== "true"`; unset in all local production env pulls |
| `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE` OFF by default | **PASS** | Same |

---

## Production environment tested

| Field | Value |
|-------|--------|
| Supabase project | `byyfylkklbxcdofaspye.supabase.co` |
| Test org (Growth Engine AI) | `00757488-1026-44a5-aac4-269533ac21be` |
| Env sources used | `.env.local.active.equipify-vercel-run-hidden`, `.env.vercel.production`, `.env.production.local` |
| Vercel production flags (pulled) | Pilot flags **unset** (equivalent to OFF) |

---

## Step 1 — Production schema health

Probes use PostgREST `Accept-Profile: growth` against live production.

| Subsystem | Tables probed | REST result | Certified |
|-----------|---------------|-------------|-----------|
| Work Orders | `ai_work_orders` | 404 PGRST205 | **NO** |
| Events | `ai_os_events`, subscriptions, deliveries, archive | 404 PGRST205 | **NO** |
| Agent Runtime | `ai_agent_runtime`, claims, heartbeats | uncertain / 404 | **NO** |
| Decision Records | `ai_decision_records` | uncertain / 404 | **NO** |
| Memory Registry | memory tables | uncertain / 404 | **NO** |
| Executive Brain | executive runtime tables | uncertain / 404 | **NO** |
| Decision Engine | decision engine tables | uncertain / 404 | **NO** |
| Context Assembly | context package tables | uncertain / 404 | **NO** |
| Provider Gateway | `ai_provider_runtime`, `ai_provider_requests` | 404 PGRST205 | **NO** |

**Note:** Schema health helpers report `ready: true` when outcome is `uncertain` (no confirmed `missing`). Production REST checks are definitive here: **tables not available**.

**Required migrations (apply in order):**

1. `20271001120000_growth_aios_2a_ai_work_orders.sql`
2. `20271001130000_growth_aios_2b_ai_events.sql`
3. `20271001140000_growth_aios_2c_ai_agent_runtime.sql`
4. `20271001150000_growth_aios_2d_decision_records.sql`
5. `20271001160000_growth_aios_2f_memory_registry.sql`
6. `20271001170000_growth_aios_2g_executive_brain.sql`
7. `20271001180000_growth_aios_2h_decision_engine.sql`
8. `20271001190000_growth_aios_2j_context_assembly.sql`
9. `20271001200000_growth_aios_3a_provider_adapters.sql`

After apply: **reload PostgREST schema cache** in Supabase dashboard (Settings → API).

---

## Step 2 — Feature flag OFF verification

| Check | Result |
|-------|--------|
| Flag unset in Vercel production env pull | **PASS** |
| `resolveLeadResearchPilotConfig()` → `enabled: false` | **PASS** |
| Recent `pilot.lead_research_*` events (24h) | **SKIPPED** — `ai_os_events` unavailable |
| Recent `research_company` provider requests (24h) | **SKIPPED** — `ai_provider_requests` unavailable |

Static guarantee: `scheduleLeadResearchPilotForProspect` returns immediately when flag is not `"true"`.

---

## Steps 3–5 — Controlled pilot E2E

| Check | Result |
|-------|--------|
| Enable pilot for test org | **NOT RUN** — schema blocked |
| Create test Growth lead | **NOT RUN** |
| Pilot scheduled → mission → planning → WO → DR → claim → context → provider → research → complete | **NOT RUN** |
| Operator page `/growth/ai-os/pilot/lead-research/[leadId]` | **NOT RUN** |

**Test org:** `00757488-1026-44a5-aac4-269533ac21be`  
**Test lead:** *(none created — cert stopped at schema gate)*

---

## Step 6 — No outbound

| Check | Result |
|-------|--------|
| Sequence enrollment | **PASS (static)** — 4A cert forbids `enroll_sequence` in pilot code |
| Email / SMS / calls / SENDR | **PASS (static)** — no outbound imports in `lib/growth/aios/pilot/*` |

Runtime negative test deferred until E2E can run.

---

## Step 7 — Core untouched

| Check | Result |
|-------|--------|
| No Core table/runtime references in pilot | **PASS** — 4A cert `assertNoCoreTouch` |
| No customer / invoice / payment / portal impact | **PASS (static)** — Growth-only paths |

---

## Step 8 — Disable flag after test

N/A — pilot was never enabled in production. **Keep flags unset/OFF.**

---

## Artifacts observed

| Artifact | Observed |
|----------|----------|
| Events | None (table unavailable) |
| Work Orders | None (table unavailable) |
| Decision Records | None |
| Context Packages | None |
| Provider requests | None |
| Research output | None |

---

## Local certification (reference)

```bash
pnpm test:ge-aios-3f-stack-certification-foundation   # PASS
pnpm test:ge-aios-4a-lead-research-pilot-foundation    # PASS
```

---

## Cleanup needed

None — no test lead or pilot data was created in production.

---

## Fix prompt (re-run 4B after remediation)

```
Apply GE-AIOS migrations 20271001120000 through 20271001200000 to production Supabase
(byyfylkklbxcdofaspye). Reload PostgREST schema cache. Confirm REST GET to
growth.ai_work_orders returns 200.

Re-run GE-AIOS-4B:

1. Schema health — all 9 subsystems REST probe returns 200
2. Flag OFF — create or inspect a lead; confirm zero pilot.lead_research_* events and
   zero new ai_provider_requests while GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED is unset
3. Ephemeral local E2E (do NOT set Vercel flag globally):
   GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED=true \
   GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE=false \
   GE_AIOS_4B_RUN_LIVE_PILOT=1 \
   pnpm test:ge-aios-4b-lead-research-pilot-production-cert
   (or manual: createGrowthLead in org 00757488… with flag true in process env only)
4. Verify observation API + operator page for test leadId
5. Confirm no sequence/email/SMS/call/SENDR side effects
6. Leave Vercel production flag OFF

Optional: add committed script test:ge-aios-4b-lead-research-pilot-production-cert
mirroring GE-OPS-1 / GS-SENDR-8A production cert pattern.
```

---

## Final verdict

| Area | Verdict |
|------|---------|
| Local stack + 4A foundation | **PASS** |
| Production schema | **FAIL** |
| Feature flag defaults | **PASS** |
| Live E2E pilot | **NOT RUN** |
| Outbound / Core (static) | **PASS** |
| **GE-AIOS-4B overall** | **FAIL** |

**GE-AIOS-4A is not production-certified until migrations are applied and E2E steps 3–5 pass.**
