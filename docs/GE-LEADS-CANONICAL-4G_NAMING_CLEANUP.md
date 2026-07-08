# GE-LEADS-CANONICAL-4G — Revenue Queue Naming Cleanup

Naming-only phase after 4F schema drop. No behavior, schema, or API URL changes.

## Canonical names

| Legacy | Canonical |
|--------|-----------|
| `GrowthLeadInboxRow` | `RevenueQueueRow` |
| `GrowthLeadInboxCardView` | `RevenueQueueCardView` |
| `GrowthLeadInboxDashboard` | `GrowthRevenueQueueDashboard` |
| `GrowthLeadInboxCard` | `GrowthRevenueQueueCard` |
| `load*ForLeadInbox` | `load*ForRevenueQueue` |
| `loadOperatorHandoffFromLeadInbox` | `loadOperatorHandoffFromRevenueQueue` |
| `buildLeadInboxCardView` | `buildRevenueQueueCardView` |
| `in_lead_inbox` (computed) | `in_revenue_queue` |

Deprecated `@deprecated` aliases remain on types, loaders, and components for incremental migration.

## API path (unchanged)

**`/api/platform/growth/lead-inbox`** is retained as a **stable compatibility path** for this phase. Clients (dashboard, hub metrics, operator workspace) still fetch this URL. Rename to `/api/platform/growth/revenue-queue` is deferred to a follow-up when call sites are audited.

## Certification

```bash
node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-naming-cleanup-4g.ts
pnpm test:growth-lead-inbox
pnpm test:growth-prospect-search
```

## Remaining cleanup (future phases)

- Rename filesystem paths: `lead-inbox-*` modules, component filenames
- API route directory rename + redirects
- Remove deprecated aliases once all imports use canonical names
- QA markers (`growth-lead-inbox-v1`) — internal only, low priority
