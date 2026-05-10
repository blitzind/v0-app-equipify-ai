# Portal settings propagation (Phase 56.2)

Staff **Settings → Customer Portal** mixes persisted workspace defaults with controls that are **not yet wired** to storage or the customer portal. This document is the source of truth for what applies to the **real portal**, **staff preview**, and **public branding**.

## Setting matrix

| Setting (staff UI) | Stored where | Save API / path | Real customer portal | Staff preview (`/portal/preview`) | Public `/api/portal/public-branding` |
| --- | --- | --- | --- | --- | --- |
| Workspace / document logo, primary accent | `organizations.logo_url`, `document_logo_url`, `primary_color` | **Settings → Workspace** → `PATCH /api/organizations/{id}/workspace` (+ logo routes) | Header brand + `--portal-accent*` via bootstrap (`PortalShell`) and `pickPreferredDocumentLogoUrl` | Same org row on preview page; inline accent vars | `logoUrl`, `primaryColor`, `organizationName` (org-scoped, no secrets) |
| Workspace name | `organizations.name` | Workspace settings | Bootstrap `organizationName`; preview title | Preview header | `organizationName` |
| Default certificate release mode | `organizations.portal_certificate_release_mode` | `PATCH …/portal/certificate-release-default` (Save on Portal page); `canManagePortalSettings` | Certificate visibility via `resolveEffectiveCertificateReleaseMode` + release evaluators | Preview `workspacePortalContext` + same resolver chain | Not exposed |
| Consolidated document library default | `organizations.portal_consolidated_documents_default` | `PATCH …/portal/consolidated-documents-default` (Save); `canManagePortalSettings` | `resolvePortalDocumentScope` / `buildPortalDocuments` | Same via `loadStaffPortalPreviewSnapshot` | Not exposed |
| Per-customer certificate override | `customers.portal_certificate_release_mode` | Customer record APIs / customer UI | Same as org default resolution | Uses selected preview customer row | Not exposed |
| Per-customer consolidated override | `customers.portal_consolidated_documents_enabled` | Customer UI + API | Document scope rollup | Same | Not exposed |
| Portal module toggles (WO, invoices, …) | *Not persisted* | — | **Not applied** — nav is not gated by these toggles | Preview layout is a single-page snapshot; not gated by toggles | — |
| Portal name, favicon (Portal page) | *Not persisted* | — | **Not used** | **Not used** | — |
| Login page copy, session days, password login | *Not persisted* | — | Portal uses **magic link**; copy/session length not configurable here | N/A (staff auth) | Optional `?organizationId=` affects accent only on login |
| Email template editors | *Not implemented* | — | **Not wired** | — | — |
| Custom domain | *Not implemented* | — | **Not wired** | — | — |
| Document activity table | `portal_activity_logs` (read via service role after permission gate) | `GET …/portal/document-access-activity` | Customer actions logged server-side; not this staff list | — | — |

## Permission model (unchanged)

- **Portal settings page** nav item: `canManagePortalSettings` (owners/admins per app matrix).
- **Certificate default PATCH** and **consolidated default PATCH**: `requireOrgPermission(…, "canManagePortalSettings")`.
- **Document activity GET**: `canManagePortalSettings` **or** `canReleaseCertificatesToPortal`.
- Per-customer consolidated/certificate overrides use the existing customer routes (managers may patch where documented).

## Preview vs real portal (intentional)

- Preview is a **read-only snapshot** (one scrollable page + anchor nav), not every `/portal/*` route. Quote/certificates/reports rows may differ from full portal nav.
- Both use the **same org fields** for accent, logos, certificate default, and consolidated default when resolving document/certificate scope for the selected customer.

## Manual test checklist

1. **Logo** — Change document/workspace logo under **Settings → Workspace**; refresh real portal and open **Preview Portal**; header logo matches.
2. **Accent** — Set **Workspace** primary color; real portal shell and preview use the same `--portal-accent*` tokens (Phase 56.1B).
3. **Certificate default** — Change default on **Customer Portal** → Save; confirm `organizations.portal_certificate_release_mode` and preview context label match; customer without override follows default.
4. **Consolidated documents** — Toggle workspace default → Save; parent/child rollup matches `resolvePortalDocumentScope` on portal documents and preview (with migration applied).
5. **Misleading controls** — Confirm Portal page does **not** offer fake save for modules/login/email/domain; those show as planned or point to Workspace.
6. **Authorization** — Non–portal-settings role cannot open PATCH endpoints (403).
7. **Login** — Magic link sign-in still works; optional `?organizationId=` on login only affects accent when branding API returns `primaryColor`.

## Related docs

- `docs/PORTAL_PREVIEW_CONTEXT.md` — preview access and accent parity.
- `docs/PORTAL_SETTINGS_UI_PHASE1.md` — consolidated docs + activity (Phase 1).
