# Growth Engine Phase 7.7A — Buying Committee Intelligence Foundation

Deterministic, evidence-backed buying committee role assignments per canonical company.

## Schema

Migration: `supabase/migrations/20270719120000_growth_engine_buying_committee_intelligence_7_7a.sql`

| Table | Purpose |
|-------|---------|
| `buying_committee_runs` | Orchestration per `company_id` |
| `buying_committee_evidence` | Auditable evidence per assignment |
| `buying_committee_intelligence_members` | Canonical committee store (7.7A spec: members; distinct from Prompt 27 `buying_committee_members`) |

**Committee roles (8):** `economic_buyer`, `technical_buyer`, `champion`, `influencer`, `end_user`, `executive_sponsor`, `procurement`, `blocker_risk_stakeholder`

## Sources (deterministic)

- `person_company_roles` with explicit `role_type` (not `unknown`)
- `company_contacts` with `metadata.committee_role` or title pattern match
- Confirmed `lead_decision_makers` linked via `company_contacts` with title pattern evidence
- Prior verified `buying_committee_intelligence_members`

## Verification & promotion

- `verifyBuyingCommitteeIntelligenceDraft` — `growth_deterministic_buying_committee_verify`
- **Title roles:** deterministic regex patterns only — each match emits `pattern_id` + cited span in evidence (not blind title inference).
- **`metadata_declared`:** requires `staging_trusted` (verified `company_contacts.contact_status` or non-empty `source_evidence`) plus `metadata_declared` evidence row.
- **Promotion:** `verified` + confidence ≥ **0.85** → `buying_committee_intelligence_members`; staging sources require `person_company_roles` or `company_contacts` link at the company.
- Max **30** assignments verified per HTTP run
- **Operator status:** `single_thread_risk` uses verified member `person_id` list (not an empty array).

## Coverage

`analyzeBuyingCommitteeCoverage` — role presence, coverage score, single-thread risk

## APIs (sync only — no 7.7B runtime)

- `POST /api/platform/growth/buying-committee-intelligence/run`
- `GET /api/platform/growth/buying-committee-intelligence/runs/[runId]`
- `GET /api/platform/growth/buying-committee-intelligence/operator-status?company_id=`

## UI

- `GrowthBuyingCommitteeIntelligencePanel` on Growth Infrastructure

## QA

- Marker: `growth-buying-committee-intelligence-7.7a-v1`
- Tests: `pnpm test:growth-buying-committee-intelligence-7.7a`

## Hard rules

No AI-generated people, no blind title guessing (pattern evidence required), no role without evidence, no intent/engagement scoring, no paid enrichment. Runtime/jobs/cron/browser/lead drawer belong in **7.7B**.
