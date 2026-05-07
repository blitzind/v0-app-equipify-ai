# Customer Portal Document Access — Phase 2

## Goal

Enable safe **parent-account document visibility foundations** and improve
**document access observability** without weakening any existing portal
release rule. Single-customer portal behavior remains the default — every
new capability is opt-in, additive, and idempotent.

## Architectural decisions

1. **Two-tier opt-in flag, default OFF.**
   - `organizations.portal_consolidated_documents_default` (`boolean`,
     defaults `false`) is the workspace-wide default.
   - `customers.portal_consolidated_documents_enabled` (`boolean`,
     nullable) is the per-customer override. `NULL` inherits the workspace
     default; `TRUE`/`FALSE` force the behavior for a specific customer.
   - Resolution lives in `lib/portal/portal-document-scope.ts` →
     `resolveConsolidatedDocumentsEnabled` (pure function, easy to unit-test).

2. **Scope resolution centralized.**
   `resolvePortalDocumentScope` (in the same file) is the single source of
   truth for "which customer ids may a portal session pull documents
   for?". It returns:
   - `customerIds` (always includes the root customer)
   - `accountLabels` (customer_id → display name; UI-only labels — never
     surfaced as UUIDs)
   - `rollupEnabled` flag (so the UI / telemetry can branch)
   - `schemaMigrationPending` flag (silent fallback to single-customer
     scope when the Phase 2 columns are missing)
   - The walk is BFS, capped at **6 levels** and **250 customers** to
     prevent runaway hierarchies. The Phase 1 cycle-prevention trigger
     (`customers_prevent_parent_cycle`) is the second line of defense.

3. **Release rules are unchanged.**
   - `canPortalDownloadCertificate` still receives the *actual owning
     customer id* (not the portal session's customer id), so payment /
     manual / immediate logic continues to fire correctly under rollup.
   - Certificate attachments stay strictly gated by the parent
     calibration record's release rule. Phase 2 added no new attachment
     gate.

4. **Telemetry uses the existing `portal_activity_logs` table** via the
   pre-existing `logPortalActivity` helper. Two new actions:
   - `portal_document_index_view` (the document library page load)
   - `portal_document_download` (cert + cert-attachment downloads)
   Metadata captures: kind, source category, rollup flag, file_type
   (when applicable), and `cross_account` boolean. **No** UUIDs, **no**
   signed URLs, **no** storage paths are persisted.

5. **Locked-document messaging** is contextual:
   - Payment-locked certificates / attachments now resolve their
     blocking invoice number when known and surface it as
     "Available once Invoice 1234 is paid." The aggregator does this
     with one extra `org_invoices` `IN (...)` query and a single
     `fetchInvoicesLinkedToWorkOrdersBatch` call across all locked-payment
     records.
   - Manual-release certificates fall back to a friendlier copy
     ("Your service provider will release this once it's ready").

6. **Single-customer behavior is preserved as default.** The bool flag
   defaults to `false` at the workspace level, the customer override is
   `NULL` (i.e. inherit), and the resolver short-circuits to a one-id
   scope when neither resolves to `true`. The `/portal/certificates`,
   `/portal/invoices`, and `/portal/work-orders` page contracts are
   unchanged in single-customer mode.

## Files changed

| Path | Purpose |
| --- | --- |
| `supabase/migrations/20260723120000_portal_document_library_phase2.sql` | Adds the org + customer flags (idempotent, nullable) |
| `lib/portal/portal-document-scope.ts` | New scope resolver + descendant walk |
| `lib/portal/portal-documents.ts` | Threads scope through; populates `accountLabel`; resolves blocking-invoice context for locked-payment certs/attachments; new `accountOptions` and `scope` fields on the result |
| `app/api/portal/documents/route.ts` | Resolves scope; emits `portal_document_index_view` telemetry |
| `app/api/portal/certificates/[recordId]/download/route.ts` | Scope-aware (single-customer behavior unchanged); `portal_document_download` telemetry; release rule still calls `canPortalDownloadCertificate` against the actual owning customer |
| `app/api/portal/certificate-attachments/[attachmentId]/download/route.ts` | Same scope-aware + telemetry pattern; parent calibration record release rule unchanged |
| `app/(portal)/portal/documents/page.tsx` | Rollup banner; account chip per non-root row; new account filter; richer locked-state copy with invoice/lock icon |
| `docs/PORTAL_DOCUMENT_LIBRARY_PHASE2.md` | This file |

## Migrations

`20260723120000_portal_document_library_phase2.sql` — additive only:

- `organizations.portal_consolidated_documents_default boolean default false`
- `customers.portal_consolidated_documents_enabled boolean` (nullable)
- `idx_customers_org_parent_active` partial index (safe to re-run)

No data backfill is required. The migration is fully idempotent
(`add column if not exists` + `coalesce(...)` defaults).

## TODOs / out of scope

- **Owner-side configuration UI** for the workspace and per-customer
  toggles is intentionally not part of this phase. Today the flags are
  only flipped via SQL or a future settings page; the portal honors them
  the moment they go live. (Recommend wiring under
  `Settings → Portal → Consolidated documents` in a follow-up.)
- **Per-document audit timeline UI** for staff (consume
  `portal_activity_logs` rows). Phase 2 only writes; reading remains a
  manual SQL query for now.
- **Invoices / Work-orders / Certificates index pages cross-account
  rollups.** Phase 2 deliberately scopes rollup to `/portal/documents`
  to keep blast radius small. A later phase can plumb the same scope
  resolver into `/portal/invoices`, `/portal/certificates`, and
  `/portal/work-orders` once we've validated rollup adoption.

## Verification

- `pnpm update:master-context` ✅
- `pnpm build` ✅
- `ReadLints` on every touched file ✅
- Manual scenarios:
  - Default config (rollup off): document library renders identically to
    Phase 1; no account chips; account filter hidden.
  - With workspace default ON: document library shows the rollup banner;
    descendant rows render an account chip with the descendant's name;
    account filter appears in the advanced filter panel.
  - Locked-payment certificate with a single linked unpaid invoice:
    reason text reads "Available once Invoice <#> is paid." UI also
    surfaces a small receipt icon next to the locked reason.
  - Cross-account download (rollup ON): both download routes generate a
    signed URL only after `canPortalDownloadCertificate` re-validates
    against the **owning customer**, not the portal session customer.
  - Schema-drift fallback (Phase 2 migration not applied): scope
    resolves to `[rootCustomerId]` and the UI behaves like Phase 1; no
    server errors.

## Deploy notes

1. Apply migration `20260723120000_portal_document_library_phase2.sql`
   to staging then production. Safe even if the customer hierarchy /
   billing migrations have not been applied yet — the scope resolver
   silently falls back to single-customer mode.
2. Verify in staging that defaults are `false`/`NULL` (rollup OFF).
3. Optional: enable rollup for a pilot parent customer via
   `update customers set portal_consolidated_documents_enabled = true where id = …`.
4. No portal session invalidation required — the resolver runs on every
   request.

## Commit / push live

```bash
git add equipify-app/supabase/migrations/20260723120000_portal_document_library_phase2.sql \
        equipify-app/lib/portal/portal-document-scope.ts \
        equipify-app/lib/portal/portal-documents.ts \
        equipify-app/app/api/portal/documents/route.ts \
        equipify-app/app/api/portal/certificates/[recordId]/download/route.ts \
        equipify-app/app/api/portal/certificate-attachments/[attachmentId]/download/route.ts \
        "equipify-app/app/(portal)/portal/documents/page.tsx" \
        equipify-app/lib/admin/master-context.generated.ts \
        equipify-app/docs/PORTAL_DOCUMENT_LIBRARY_PHASE2.md

git commit -m "Portal Document Access Phase 2: parent rollup foundation + telemetry"
git push origin HEAD
```
