# Growth Engine Phase 7.PS-FB — Prospect Search Workspace Execution Preview & Worklists

Extends 7.PS-FA operator workspace with actionable read-only worklists, client-side selection, and bulk execution preview. No job execution, enqueue, providers, scoring changes, or persistence.

## Workspace view activation

Selecting a workspace view filters the **shell-visible company set** (`displayCompanies`): command work-view filter (if any) → workspace view filter (PS-FA `matchProspectSearchWorkspaceView`). Applies to:

- Internal card results (`CompanyResultCard`)
- Internal table results (`CompanyResultsTable`)
- Discover external results (`ProspectSearchDiscoverResultsTable` via `displayDiscoverResults`)
- Results header count, pagination total (companies mode), bulk “select all visible”, saved-search batch launch review

Underlying `result.companies` is never mutated.

## Worklists

`prospect-search-workspace-worklists.ts` builds operator worklists from PS-FA queue/tier membership with per-kind display fields. Worklists use `visibleCompanies` passed from the shell so metrics/selection align with filtered results.

## Bulk execution preview

`buildProspectSearchWorkspaceExecutionPreview` — selected queue + selected accounts → PS-C planner output only (`buildProspectSearchActionableResearchPlan`, `buildProspectSearchSuggestedGrowthEngineActions`, `planProspectSearchWorkspaceBulkAction`).

## Selection & metrics

Client-only selection helpers (`prospect-search-workspace-selection.ts`). Metrics derived in `prospect-search-workspace-metrics.ts` from visible/selected keys and preview rows.

## UI

- `ProspectSearchWorkspaceWorklistCard`
- `ProspectSearchWorkspaceExecutionPreviewCard`
- `ProspectSearchWorkspaceSelectionBar`
- `ProspectSearchOperatorWorkspacePanel` (receives `visibleCompanies` from shell)

## Libs

- `prospect-search-workspace-worklists.ts`
- `prospect-search-workspace-execution-preview.ts`
- `prospect-search-workspace-selection.ts`
- `prospect-search-workspace-metrics.ts`
- `filterProspectSearchDiscoverResultsToVisibleCompanies` in `prospect-search-workspace.ts`

## Tests

```bash
pnpm test:growth-prospect-search-workspace-7-ps-fb
pnpm test:growth-prospect-search-workspace-7-ps-fa
```

QA marker: `growth-prospect-search-workspace-7-ps-fb-v1`
