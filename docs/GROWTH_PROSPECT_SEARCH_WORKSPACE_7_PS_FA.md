# Growth Engine Phase 7.PS-FA — Prospect Search Operator Workspace Foundations

Turns hydrated Prospect Search results into an operator command center using read-only PS-A (intelligence), PS-D (readiness), and PS-E (coverage). No new scoring, providers, or job execution.

## Workspace aggregates

**Prioritization rollups** (from PS-D `prioritization_tier`):

- `accounts_ready_for_outreach`
- `accounts_with_gaps`
- `research_first_accounts`
- `insufficient_data_accounts`

**Research queues** (PS-D + PS-E + engine overlay):

- Missing verified email / phone / social
- Missing committee / company intelligence
- Unresolved company / contacts

**Coverage queues** (PS-E metrics + committee flags):

- Low person linkage (&lt;50%)
- Single-thread risk
- No economic buyer / champion
- Low company intelligence coverage (&lt;40%)

## Saved workspace views

Configuration-only definitions in `prospect-search-workspace-views.ts` (no persistence):

Outreach Ready, Research Queue, Committee Gaps, Missing Emails, Missing Phones, Low Coverage, Unresolved Accounts.

## Bulk action planner

`planProspectSearchWorkspaceBulkAction` delegates to PS-C `buildProspectSearchActionableResearchPlan`. Returns counts, affected accounts/companies/persons, blocked accounts + reasons. Does **not** enqueue or execute jobs.

## Workspace health

Operator metrics derived from hydrated refs: canonical company %, person linkage %, verified channel %, committee %, company intelligence %, outreach ready %.

## UI (display only)

- `ProspectSearchWorkspaceSummaryCard`
- `ProspectSearchWorkspaceQueuesCard`
- `ProspectSearchWorkspaceHealthCard`
- `ProspectSearchWorkspaceViewSelector`
- `ProspectSearchOperatorWorkspacePanel` (wired in `prospect-search-shell.tsx`)

## Libs

- `prospect-search-workspace-types.ts`
- `prospect-search-workspace-views.ts`
- `prospect-search-workspace-ux.ts`
- `prospect-search-workspace.ts`

## Tests

```bash
pnpm test:growth-prospect-search-workspace-7-ps-fa
```

QA marker: `growth-prospect-search-workspace-7-ps-fa-v1`
