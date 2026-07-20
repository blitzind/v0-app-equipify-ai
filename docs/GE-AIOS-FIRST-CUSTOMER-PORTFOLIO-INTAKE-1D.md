# GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D

Production audit of every Prospect Search survivor to determine why qualified companies never became leads.

**Org:** `00757488-1026-44a5-aac4-269533ac21be`  
**Constraint:** Audit-only — no ICP weakening, no volume inflation, no outbound enablement.

## Certification

| Command | Result |
|---------|--------|
| `pnpm test:ge-aios-first-customer-portfolio-intake-1d` | PASS |
| `pnpm probe:ge-aios-first-customer-portfolio-intake-1d` | PASS (production, 2026-07-16) |

## Executive Summary

Production evidence confirms **zero** of the 77 audited Prospect Search survivor instances were promoted to leads via the autonomous portfolio intake path. The 2 existing org leads (Block Imaging, phone intake) came from **separate intake paths** and do not appear in the replayed autonomous discovery survivor inventory.

The root cause is architectural: **completed DataMoon runs are orphaned** — the scheduler never resumes them for `executeBulkPushToLeadInbox` on subsequent ticks.

| Metric | Value |
|--------|------:|
| Survivor instances (all runs) | 77 |
| Unique canonical companies | 21 |
| Completed discovery runs | 34 |
| Runs with any promotion | 0 |
| Incorrectly withheld (bug) | 21 |
| Correctly withheld (duplicate rediscovery) | 56 |
| Unclassified | 0 |

## Phase 1 — Full Survivor Inventory

Every survivor from 34 completed autonomous discovery runs is in the probe JSON (`inventory` array — no sampling). Each row includes:

- Company, run ID, audience ID, discovery date
- Rank score, run rank, batch size at run
- Research status, lead status, admission status
- Classification + decision trace

**Note on 75 → 77:** Pipeline scaling audit (1C) reported 75 cumulative survivors; 2 additional instances appeared from runs completed between audits.

## Phase 2 — Classification Table

Every non-promoted survivor is classified exactly once:

| Classification | Count | Assessment |
|----------------|------:|------------|
| **bug** | 21 | Incorrectly withheld — first canonical instance per company |
| **duplicate_company** | 56 | Correctly withheld — same company rediscovered in later runs |
| **Total** | **77** | |

No survivors remain in `unknown`. Categories with zero count: `already_existing_lead`, `already_existing_customer`, `duplicate_contact`, `research_*`, `waiting_for_batch_promotion`, `waiting_for_scheduler`, `portfolio_capacity_limit`, `explicit_rejection`.

## Phase 3 — Decision Trace

### Incorrectly withheld (bug) — all 21 unique companies

```text
function: findActiveAutonomousProspectSearchDatamoonRun
file:   lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts
condition: run.status not in ("pending_build","building") — completed runs excluded
return: runProspectSearchDatamoonAutonomousDiscovery → startDatamoonAudienceImportRun (new job)
stop:   Completed run survivors never reach executeBulkPushToLeadInbox
```

Promotion path that **should** run but doesn't on completion tick:

```text
runAutonomousPortfolioDiscoveryBatch
  → runProspectSearch (discover_external)
  → resume completed run → mapped.companies
  → search.companies.slice(0, batchSize)
  → executeBulkPushToLeadInbox
  → pushProspectSearchCompanyToLeadInbox
  → createLeadCandidate
```

### Correctly withheld (duplicate_company) — 56 instances

Same canonical company rediscovered across subsequent autonomous runs. Correct disposition — no second promotion attempted.

## Phase 4 — Correct vs Incorrect

| Category | Count |
|----------|------:|
| Correctly not promoted | 56 |
| Incorrectly not promoted | 21 |

### Existing leads outside survivor inventory

| Lead | ID | Note |
|------|-----|------|
| Block Imaging | `6d9220f0-2960-468c-b4be-5d7595d292c3` | Not in replayed survivor set — separate intake path |
| Call — +15623625489 | `3c09059b-a5bf-44fb-b8b9-33994e7a4c79` | Phone intake — not from DataMoon survivor replay |

These 2 leads explain the 1C "2 leads created" count but are **not** promotions from the 77 audited survivors.

## Phase 5 — Bottleneck Quantification

| Reason | Count |
|--------|------:|
| Duplicate company (correct) | 56 |
| Portfolio bug — orphaned completed run | 21 |
| **Total non-promoted survivors** | **77** |

## Phase 6 — Throughput Projection (incorrect fixes only)

Production evidence only — no post-intake conversion speculation:

| Metric | Current | If orphan-run bug fixed |
|--------|--------:|--------------------------:|
| Unique Prospect Search survivors | 21 | 21 |
| Leads created | 2 | 23 (2 existing + 21 recoverable) |
| Research initiated | 1 | 22 (evidence: +1 per recoverable lead) |
| Approval packages | 1 | 1 (unchanged — no evidence) |
| Outreach-ready | 1 | 1 (unchanged — no evidence) |

Admission, OMT, and outreach conversion rates are **not** projected beyond current production counts.

## Phase 7 — Architecture Audit

| Gate | Changed? |
|------|----------|
| Business Profile | No |
| SSV | No |
| OMT | No |
| Provider bridge | No |
| Prospect Search | No |
| Operational Keyword Validation | No |
| Admission | No |
| Seller Truth | No |
| ICP standards | Not weakened |

## Root Cause

**Orphaned completed-run intake gap** — tenant-agnostic, affects any future customer using autonomous portfolio discovery.

`ACTIVE_STATUSES` in `prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts` includes only `pending_build` and `building`. When a run completes, the next scheduler tick starts a **new** DataMoon job instead of resuming the completed run for batch promotion.

### Smallest required fix (not implemented in this milestone)

Extend lifecycle lookup to find the latest **completed but unpromoted** autonomous run for the organization and resume it for `executeBulkPushToLeadInbox` on the first tick after completion. Tenant-agnostic — no Equipify-specific exceptions.

## Files Changed

| File | Role |
|------|------|
| `lib/growth/training/portfolio-intake-survivor-types-1d.ts` | Classification types + QA marker |
| `lib/growth/training/portfolio-intake-survivor-classification-1d.ts` | Decision traces + summary helpers |
| `lib/growth/training/portfolio-intake-survivor-loader-1d.ts` | Full survivor inventory loader |
| `lib/growth/training/portfolio-intake-production-audit-1d.ts` | Production orchestrator |
| `scripts/probe-ge-aios-first-customer-portfolio-intake-1d.ts` | Production probe |
| `scripts/test-ge-aios-first-customer-portfolio-intake-1d.ts` | Local certification |
| `package.json` | Script entries |
| `docs/GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D.md` | This report |

## Recommended Next Milestone

**GE-AIOS-PORTFOLIO-INTAKE-ORPHAN-RUN-CLOSURE-1E** — Implement tenant-agnostic completed-run resume for batch promotion; re-run this probe to verify survivor → lead disposition with zero `bug` classifications before returning to pipeline scaling (1C re-probe) or supervised send (1D).

```bash
pnpm probe:ge-aios-first-customer-portfolio-intake-1d
```

Expected post-fix: 21 unique survivors promoted (subject to dedupe), 56 duplicate instances remain correctly withheld, `bug` count → 0.
