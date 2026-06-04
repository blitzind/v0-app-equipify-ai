# Phase 6.34B — Native Outbound Dogfood Validation

Execution plan for validating the full Growth Engine with **real internal outreach** (native Gmail / standalone mode). No new features — operator validation only.

QA: `dogfood-validation-v1` · Native cutover: `growth-native-outbound-cutover-v1` · Attribution: `growth-revenue-attribution-dashboard-v2`

---

## Pre-flight (Michael — before touching prospects)

| Check | Action | Failure if |
|-------|--------|------------|
| Env | Confirm `GROWTH_OUTBOUND_MODE=standalone`, `GROWTH_ALLOW_ADAPTER_OUTBOUND` unset | Adapter/Lemlist queue active |
| Secrets | `CRON_SECRET`, `GROWTH_PROVIDER_CREDENTIALS_PEPPER`, Google OAuth set | Sends fail or simulate |
| Simulate off | `GROWTH_TRANSPORT_SIMULATE` and `GROWTH_INBOX_SYNC_SIMULATE` **unset** | Fake message IDs, no inbox |
| Migrations | Ledger `20270706120000` applied | Attribution 503 / empty |
| Mailbox | Connect sending Gmail at `/admin/growth/providers/setup` | Cannot approve/send |
| Cutover | `/admin/growth/operations/outbound` → `native_cutover.adapter_execution_enabled: false` | Wrong execution plane |
| Crons | `growth-sequence-scheduler`, `growth-sequence-safe-execute`, `growth-inbox-sync` healthy in ops view | Jobs stuck `pending_approval` |

Record baseline on `/admin/growth/dogfood` (subsystems → `testing`).

---

## Test lead requirements (10 prospects)

Use a **single Seamless/manual CSV batch** tagged `dogfood-6.34b-YYYY-MM-DD`.

| Field | Requirement |
|-------|-------------|
| **Count** | Exactly **10** rows (new companies; avoid deduping into existing pipeline) |
| **Email** | Addresses **you control** (Gmail aliases `+dogfood1`… or dedicated test inboxes) so you can **reply as the prospect** |
| **Company** | 10 distinct company names (attribution by campaign/industry later) |
| **Contact** | First + last name; valid phone optional |
| **Website** | Real URLs (research step needs fetchable sites) |
| **Source** | Consistent `source_channel` / campaign label in CSV if columns exist (e.g. `dogfood_internal`) |
| **Suppression** | None on global/org suppression lists |
| **Volume** | Low-touch sequence (1–2 email steps) for first dogfood run |

**Do not use:** Apollo import (stub), Lemlist, or `/admin/growth/outreach/approval` legacy queue.

---

## Michael’s 10-prospect playbook (exact steps)

### Day 0 — Setup (30 min)

1. Open `/admin/growth/operations/outbound` — screenshot `native_cutover` + cron health.
2. Open `/admin/growth/dogfood` — set **Import**, **Outbound**, **Reply**, **Pipeline** to `testing`.
3. Prepare CSV per table above.
4. Pick **one active sequence template** (email-only, 1–2 steps) — note `sequence_id` from `/admin/growth/sequences`.

### Day 1 — Import + research (10 leads)

| Step | UI | Do |
|------|-----|-----|
| 1. Import | `/admin/growth/imports` | Upload CSV → **Preview** → fix errors → **Commit** batch |
| 2. Verify leads | `/admin/growth/leads/crm` or batch detail `/admin/growth/imports/[batchId]` | 10 leads `new`/`active`, assigned to you |
| 3. Research | `/admin/growth/leads/[leadId]` (each lead, or batch research if available) | Run **Research**; wait for completed run / timeline event |
| 4. Dogfood | `/admin/growth/dogfood` | Record **Import** run `validated` if SQL checks pass (below) |

### Day 1–2 — Personalize + enroll + approve + send (all 10)

| Step | UI | Do |
|------|-----|-----|
| 5. Personalize | `/admin/growth/copilot/personalization` or lead workspace | Generate → review → **Approve** (confirm human approval) for each lead |
| 6. Enroll | `/admin/growth/sequences` or lead → enroll | Enroll all 10 into dogfood sequence |
| 7. Scheduler | Wait ≤10 min or trigger cron manually | Jobs appear `pending_approval` |
| 8. Approve | `/admin/growth/sequences/execution` | For each job: **Approve** (and **Run** if UI requires separate run after approve) |
| 9. Send verify | Lead timeline + ops outbound | Status `sent`; real email in **your** Gmail Sent |
| 10. Dogfood | `/admin/growth/dogfood` | Record **Outbound** `validated` when ≥10 `delivery_attempts` sent via transport |

### Day 2–3 — Replies as prospect (at least 3 of 10)

| Step | UI | Do |
|------|-----|-----|
| 11. Reply | From prospect inbox | Reply to 3+ dogfood emails (mix: positive interest, question, objection) |
| 12. Inbox sync | Wait ≤15 min or run `growth-inbox-sync` | `/admin/growth/inbox` — threads appear, linked to leads |
| 13. Reply intel | `/admin/growth/inbox` → thread workspace | Confirm intent/signals; run workflow actions if prompted |
| 14. Memory | `/admin/growth/intelligence/relationship-memory` or lead panel | Profile updated after reply |
| 15. NBA | `/admin/growth/leads/[leadId]` | `next_best_action` changed post-reply |
| 16. Dogfood | `/admin/growth/dogfood` | **Reply** → `validated` |

### Day 3–4 — Pipeline + closed won (≥1 full path)

| Step | UI | Do |
|------|-----|-----|
| 17. Opportunity | `/admin/growth/inbox` or `/admin/growth/opportunities/pipeline` | **Create opportunity** for best reply lead (human confirm) |
| 18. Progress | Pipeline board | Move stages toward **Closed Won** for **≥1** opp (realistic amount, e.g. $5,000) |
| 19. Dogfood | `/admin/growth/dogfood` | **Pipeline** → `validated` |

### Day 4 — Attribution (all models)

| Step | UI | Do |
|------|-----|-----|
| 20. Dashboard | `/admin/growth/revenue-attribution` | Toggle **First / Last / Linear / Time decay** — revenue by channel/sequence shifts |
| 21. Recommendations | Same page — Recommendations section | High-confidence + funnel cards; copy one rec; mark reviewed |
| 22. Dogfood | Command center summary | Overall readiness; file issues for any failure |

### Optional (same week)

- `/admin/growth/leads/queue` — call disposition on 1 lead (call touch).
- `/admin/growth/replies/workflow` — bulk workflow center check.

---

## Dogfood checklist (14 validation areas)

| # | Area | Pass criteria | Record on `/admin/growth/dogfood` |
|---|------|---------------|-----------------------------------|
| 1 | Lead import | Batch `completed`; 10 leads; `lead_import` touches | Import → `validated` |
| 2 | Research | ≥8/10 leads with research run + `research` touch | (part of Import or notes) |
| 3 | Personalization | 10 approved generations + `personalization` touches | Outbound |
| 4 | Enrollment | 10 `sequence_template_enrollments` active | Outbound |
| 5 | Approval | 10 jobs `approved` / sent | Outbound |
| 6 | Native Gmail send | `delivery_attempts.status=sent`, provider=gmail/transport | Outbound |
| 7 | Inbox reply | ≥3 `inbox_threads` with inbound messages | Reply |
| 8 | Reply intelligence | Classifications + workflow events on those threads | Reply |
| 9 | Memory update | `lead_memory_profiles` / events updated for reply leads | Reply |
| 10 | NBA update | `leads.next_best_action` non-null and changed post-reply | Reply |
| 11 | Opportunity creation | ≥1 `opportunities` row linked to lead | Pipeline |
| 12 | Closed won | ≥1 opp `closed_won_at` set + `opportunity_won` touch | Pipeline |
| 13 | Attribution dashboard | All 4 models show non-zero attributed revenue for won deal | Pipeline / notes |
| 14 | Attribution recommendations | Recommendations load; model label matches selector | Pipeline / notes |

---

## Expected outcomes

| Stage | Expected |
|-------|----------|
| Import | 10 new `growth.leads`, batch status `completed`, timeline `import_*` events |
| Research | `growth.research_runs` or lead research status usable; touch `research` |
| Personalization | `growth.personalization_generations.status=approved` |
| Enrollment | Enrollments + `sequence_execution_jobs` `pending_approval` → `approved` → sent |
| Send | Gmail message ID; `growth.delivery_attempts` sent; touch `email_send` |
| Inbox | `growth.inbox_threads` + messages; touch `reply` |
| Reply intel | `growth.outbound_replies` or reply intel tables populated; SLA/events |
| Memory | `growth.lead_memory_profiles` updated_at after reply |
| NBA | Lead row NBA fields updated |
| Opportunity | `growth.opportunities` created; touch `opportunity_created` |
| Closed won | `closed_won_at` set; touch `opportunity_won`; path rebuilt |
| Attribution | Dashboard funnel counts ≥1 won; dimension tables credit sequence/channel |
| Recommendations | ≥1 high-confidence or bottleneck card; rollups JSON non-empty |

---

## Failure conditions (stop and file dogfood issue)

| Area | Failure |
|------|---------|
| Import | Batch `failed`; &lt;10 leads; duplicate merge swallowed all rows |
| Research | All runs `failed` or blocked; no `research` touches |
| Personalization | Blocked generations; approve without touch |
| Enrollment | Enroll errors; no jobs scheduled |
| Approval | Jobs stuck `pending_approval` &gt;30 min with healthy crons |
| Send | `assertPreSendAllowed` errors; simulate IDs; no Gmail sent |
| Inbox | No thread after reply + sync; wrong lead linkage |
| Reply intel | No classification; workflow 500 |
| Memory | No profile change after reply processing |
| NBA | NBA null or unchanged after reply ingest |
| Opportunity | Cannot create; duplicate opp per lead broken |
| Closed won | Stage move without `opportunity_won` touch |
| Attribution | Schema 503; all models zero revenue on won deal |
| Recommendations | API error; empty with known won data |

Severity: **critical** = blocks next step; **high** = workaround exists; file at `/admin/growth/dogfood` → Issues.

---

## SQL verification queries

Replace `:lead_id`, `:batch_id`, `:opp_id`, `:email` with real values.

### 1–2 Import + research

```sql
-- Batch status
select id, status, row_count, created_at
from growth.lead_import_batches
where id = :batch_id;

-- Dogfood leads
select id, contact_email, company_name, status, source_channel, last_researched_at
from growth.leads
where contact_email ilike '%dogfood%' or source_channel = 'dogfood_internal'
order by created_at desc
limit 10;

-- lead_import + research touches
select touch_type, count(*)
from growth.attribution_touches
where lead_id in (select id from growth.leads where contact_email ilike '%dogfood%')
group by 1;
```

### 3–6 Personalization, enrollment, send

```sql
select lead_id, status, personalization_score, approved_at
from growth.personalization_generations
where lead_id = :lead_id
order by created_at desc limit 3;

select id, status, sequence_id, enrolled_at
from growth.sequence_template_enrollments
where lead_id = :lead_id;

select id, status, channel, human_approved_at, sent_at, error_message
from growth.sequence_execution_jobs
where lead_id = :lead_id
order by created_at desc;

select id, status, provider_family, external_message_id, sent_at
from growth.delivery_attempts
where lead_id = :lead_id
order by sent_at desc;
```

### 7–10 Inbox, reply intel, memory, NBA

```sql
select t.id, t.subject, t.thread_status, t.last_message_at
from growth.inbox_threads t
where t.lead_id = :lead_id;

select lead_id, intent, received_at
from growth.outbound_replies
where lead_id = :lead_id
order by received_at desc;

select lead_id, relationship_stage, updated_at, memory_coverage_score
from growth.lead_memory_profiles
where lead_id = :lead_id;

select id, next_best_action, next_best_action_reason, updated_at
from growth.leads
where id = :lead_id;
```

### 11–12 Opportunity + closed won

```sql
select id, lead_id, stage_key, amount, closed_won_at, created_at
from growth.opportunities
where lead_id = :lead_id;

select touch_type, touched_at, opportunity_id
from growth.attribution_touches
where lead_id = :lead_id
  and touch_type in ('opportunity_created', 'opportunity_won')
order by touched_at;
```

### 13–14 Attribution path + credits

```sql
select path_scope, touch_count, first_touch_id, last_touch_id,
       path_summary->'touch_credits_by_model' as credits
from growth.attribution_paths
where lead_id = :lead_id;

-- Won deal revenue in dashboard window (last 30d)
select o.id, o.amount, o.closed_won_at
from growth.opportunities o
where o.closed_won_at is not null
order by o.closed_won_at desc
limit 5;
```

### Native cutover sanity

```sql
select status, count(*)
from growth.sequence_execution_jobs
where created_at > now() - interval '7 days'
group by 1;

-- Should NOT see new outreach_queue executes in standalone mode
select status, count(*)
from growth.outreach_queue
where created_at > now() - interval '7 days'
group by 1;
```

---

## Admin pages to monitor

| Purpose | URL |
|---------|-----|
| Dogfood scorecard | `/admin/growth/dogfood` |
| Command summary | `/admin/growth/command` |
| Outbound ops | `/admin/growth/operations/outbound` |
| Imports | `/admin/growth/imports` |
| Leads CRM | `/admin/growth/leads/crm` |
| Lead detail | `/admin/growth/leads/[leadId]` |
| Personalization | `/admin/growth/copilot/personalization` |
| Sequences | `/admin/growth/sequences` |
| Execution / approve | `/admin/growth/sequences/execution` |
| Inbox | `/admin/growth/inbox` |
| Reply workflow | `/admin/growth/replies/workflow` |
| Relationship memory | `/admin/growth/intelligence/relationship-memory` |
| Pipeline | `/admin/growth/opportunities/pipeline` |
| Revenue attribution | `/admin/growth/revenue-attribution` |
| Inbox diagnostics | `/admin/growth/inbox/diagnostics` (if sync issues) |
| Provider setup | `/admin/growth/providers/setup` |

---

## Success criteria (6.34B complete)

1. **All 14 checklist rows** pass with evidence (SQL + screenshots).
2. **≥1 lead** full path: import → send → reply → opp → **closed won** → attribution (4 models) → recommendations.
3. **≥3 leads** receive send + at least one reaches inbox reply stage.
4. **Zero critical** open dogfood issues; `readyForBlitzUsage === true` on dogfood dashboard.
5. Subsystems marked **`validated`**: Import, Outbound, Reply, Pipeline (Meeting/Lifecycle optional `not_tested`).
6. No adapter plane usage (outreach queue / Lemlist) during run.
7. Michael sign-off note on dogfood run: date, batch id, sequence id, won opportunity id.

---

## Suggested test script (engineering support)

```bash
pnpm test:growth-dogfood-validation
pnpm test:growth-outbound-cutover
pnpm test:growth-operational-send-plane
pnpm test:growth-sequence-safe-execution
pnpm test:growth-unified-inbox
pnpm test:growth-reply-intelligence-v2
pnpm test:growth-attribution-touch-ledger
pnpm test:growth-revenue-attribution-dashboard
tsx scripts/verify-growth-production-runtime.ts
```

Run **before** Michael starts Day 1 in target environment.
