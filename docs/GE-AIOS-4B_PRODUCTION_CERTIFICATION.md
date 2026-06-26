# GE-AIOS-4B — Lead Research Pilot Production Certification (Rerun)

**Phase:** GE-AIOS-4B-RERUN — Production migration apply + pilot certification  
**Date:** 2026-06-26  
**Verdict:** **PASS**  
**Production:** `byyfylkklbxcdofaspye.supabase.co`  
**Test org:** `00757488-1026-44a5-aac4-269533ac21be`

---

## 1. Migration apply result — **PASS**

Applied via linked Supabase CLI (`supabase db push --yes`):

| Migration | Status |
|-----------|--------|
| `20271001120000_growth_aios_2a_ai_work_orders.sql` | Applied |
| `20271001130000_growth_aios_2b_ai_events.sql` | Applied |
| `20271001140000_growth_aios_2c_ai_agent_runtime.sql` | Applied |
| `20271001150000_growth_aios_2d_decision_records.sql` | Applied |
| `20271001160000_growth_aios_2f_memory_registry.sql` | Applied |
| `20271001170000_growth_aios_2g_executive_brain.sql` | Applied |
| `20271001180000_growth_aios_2h_decision_engine.sql` | Applied |
| `20271001190000_growth_aios_2j_context_assembly.sql` | Applied |
| `20271001200000_growth_aios_3a_provider_adapters.sql` | Applied |

SQL confirmation: `ai_work_orders`, `ai_os_events`, `ai_provider_requests` present in `growth` schema.

---

## 2. PostgREST schema cache reload — **PASS**

```sql
NOTIFY pgrst, 'reload schema';
```

Executed on linked production database via `supabase db query --linked`.

---

## 3. REST probe result — **PASS**

| Table | HTTP status |
|-------|-------------|
| `growth.ai_work_orders` | **200** |
| `growth.ai_os_events` | **200** |
| `growth.ai_provider_requests` | **200** |

All nine schema health probes: `ready: true`, `verified: true`.

---

## 4. Feature flags — **PASS (OFF globally)**

| Flag | Vercel / process env during cert |
|------|----------------------------------|
| `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED` | **false** (unset) |
| `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE` | **false** (unset) |

Pilot E2E used **process env only** (`GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED=true` in cert harness — not Vercel).

---

## 5. Flag-OFF verification — **PASS**

| Check | Result |
|-------|--------|
| Lead created with flag OFF | `3236cca1-9315-43b9-b7a2-f2feb38d17b0` |
| Pilot step events | 0 |
| Pilot steps | All pending |

---

## 6. Controlled E2E pilot (process env only) — **PASS**

| Artifact | Value |
|----------|-------|
| Test lead | `5469ab95-79ce-4831-9695-fbbcbdab4d25` |
| Mission | `d702724e-6565-4db7-a2f0-d686fea7623a` |
| Work order | `c38fd92f-0856-41d2-92d8-9f95bd9461d7` (`research_company`, **completed**) |
| Research run | `64113b7e-7e72-4776-b5c8-97700f69ddc3` |
| Provider request | OpenAI `research_company` — **completed** |
| Decision records (org) | 6 |
| Context packages (org) | 5 |
| Outbound | None observed |

Pipeline confirmed: planning tick → WO → decision prep → agent claim → context assembly → AI OS provider gateway → research saved → WO complete.

---

## 7. Cert failures fixed during rerun (code changes)

| Issue | Fix |
|-------|-----|
| Pilot `correlation_id` used non-UUID string | Use `leadId` as correlation ID in observability |
| Provider returned markdown for `research_company` | JSON system prompt + `structuredMode: json_object` |
| Invalid `decision_maker_candidates` shape | Normalize before schema parse in executor |
| `applyGrowthLeadResearchEnrichment` ReferenceError | Use `input.result` instead of bare `result` |

---

## 8. Cleanup needed

**Optional retention review** — cert created multiple test leads and AI OS artifacts in production test org:

| Type | IDs (latest successful run) |
|------|----------------------------|
| Flag-off probe leads | `3236cca1-9315-43b9-b7a2-f2feb38d17b0` (+ earlier probe leads) |
| E2E pilot lead | `5469ab95-79ce-4831-9695-fbbcbdab4d25` |
| Stuck agent leases | Released manually during cert (`ge-aios-4b-rerun-cert-cleanup-*`) |

No outbound (sequence, email, SMS, calls, SENDR). Equipify Core untouched.

**Vercel:** Keep `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED` **OFF** globally unless explicitly enabling for a controlled window.

---

## Final verdict

| Step | Result |
|------|--------|
| Migrations | **PASS** |
| Schema cache reload | **PASS** |
| REST probes | **PASS** |
| Flag OFF | **PASS** |
| E2E pilot (process env) | **PASS** |
| **GE-AIOS-4B overall** | **PASS** |

GE-AIOS-4A Lead Research Pilot is **production-certified** for controlled, feature-flagged rollout.
