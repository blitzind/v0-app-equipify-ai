# Growth Engine Phase 7.PS-FC — Prospect Search Controlled Bulk Execution

Turns 7.PS-FB execution previews into explicit operator-approved bulk enqueue actions using the existing PS-C `executeProspectSearchActionableResearch` path and Growth Engine job APIs.

## Bulk execution layer

`prospect-search-workspace-bulk-execution.ts`:

- `validateProspectSearchWorkspaceBulkExecution` — guards (selection, preview, queue, mapped lane, executable count, max 25 accounts)
- `executeProspectSearchWorkspaceBulkResearch` — uses PS-FB preview + `planProspectSearchWorkspaceBulkAction` eligibility; enqueues only preview-eligible accounts; skips blocked; no legacy lane bulk enqueue
- `logProspectSearchWorkspaceBulkExecutionSummary` — client `console.info` summary (job APIs retain authoritative enqueue logs)

## Operator flow

1. Select workspace view and accounts
2. Select research/coverage queue
3. Review execution preview
4. **Queue selected research** → confirmation
5. **Confirm queue** / **Cancel**
6. Per-account and aggregate results (no auto-retry)

## UI

- `ProspectSearchWorkspaceBulkExecutionCard` in `ProspectSearchOperatorWorkspacePanel`
- No auto-execute on filter/selection changes

## Hard rules

No sync `/run`, no canonical table writes, no new providers, no outreach/dial/SMS, no persistence of selection, no autonomous triggers.

## Tests

```bash
pnpm test:growth-prospect-search-workspace-7-ps-fc
pnpm test:growth-prospect-search-workspace-7-ps-fb
pnpm test:growth-prospect-search-actionable-research-7-ps-c
```

QA marker: `growth-prospect-search-workspace-7-ps-fc-v1`
