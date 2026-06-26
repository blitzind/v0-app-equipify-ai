# GE-AIOS-3F — Migration Readiness Checklist

**Phase:** GE-AIOS-3F  
**Date:** 2026-06-25  
**Status:** Ready for staged apply (local cert complete)

---

## Pre-apply prerequisites

| # | Prerequisite | Status |
|---|--------------|--------|
| 1 | `public.organizations` exists | Required by all AI OS migrations |
| 2 | `growth.organization_growth_objectives` exists (GE-AUTO-2G) | Required by 2A, 2B, 2D, 2F, 2G |
| 3 | Growth schema (`growth.*`) accessible to service role | Required |
| 4 | All GE-AIOS 2A–3E local certs pass | ✅ |
| 5 | No Equipify Core schema changes in this batch | ✅ |

---

## Migration apply order (strict)

Apply in filename order — each migration includes dependency guards:

| Order | Migration | Phase | Creates / extends |
|-------|-----------|-------|-------------------|
| 1 | `20271001120000_growth_aios_2a_ai_work_orders.sql` | 2A | `growth.ai_work_orders`, `growth.ai_work_order_events` |
| 2 | `20271001130000_growth_aios_2b_ai_events.sql` | 2B | `growth.ai_os_events`, subscriptions |
| 3 | `20271001140000_growth_aios_2c_ai_agent_runtime.sql` | 2C | Agent runtime + lease tables |
| 4 | `20271001150000_growth_aios_2d_decision_records.sql` | 2D | `growth.ai_decision_records` |
| 5 | `20271001160000_growth_aios_2f_memory_registry.sql` | 2F | Memory registry tables |
| 6 | `20271001170000_growth_aios_2g_executive_brain.sql` | 2G | Executive Brain runtime + mission state |
| 7 | `20271001180000_growth_aios_2h_decision_engine.sql` | 2H | Decision Engine runtime |
| 8 | `20271001190000_growth_aios_2j_context_assembly.sql` | 2J | Context assembly + packages |
| 9 | `20271001200000_growth_aios_3a_provider_adapters.sql` | 3A | Provider request audit tables |

**Note:** GE-AIOS-2E (Decision Gate), 2I (Execution Bridge), 3B–3E are **service-layer only** — no additional migrations.

---

## Post-apply verification

| # | Check | Command / action |
|---|-------|------------------|
| 1 | Schema health probes | Run growth AI OS schema health endpoints (when wired) or SQL spot-check tables |
| 2 | Re-run stack cert | `pnpm test:ge-aios-3f-stack-certification-foundation` |
| 3 | Confirm no Core tables altered | Verify `public.work_orders` unchanged |
| 4 | Smoke planning review UI | Load `/growth/os/missions/[missionId]/planning` with test mission |
| 5 | Confirm no cron/autonomous wiring | No new scheduled jobs in this batch |

---

## Rollback notes

- Migrations use `create table if not exists` patterns where applicable.
- Rollback is **manual** — no down migrations shipped in this batch.
- Safe rollback strategy: disable Growth AI OS feature flags / routes; do not drop tables in production without amendment.

---

## Environment variables (reference only)

No new secrets required for infrastructure apply. Provider invocation (3A/3B) uses existing org/platform LLM config when opt-in evidence is enabled.

---

**Not committed / not deployed** per phase policy.
