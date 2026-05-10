# Portal preview context (Phase 56.1)

Staff-facing **portal preview** (`/portal/preview`) shows a read-only snapshot of what a **selected customer** would see in the customer portal, without minting a customer portal session cookie.

## How a real customer session works

1. Customer follows an invite / magic link → `POST /api/portal/access/exchange` validates token.
2. Server sets `PORTAL_SESSION_COOKIE` with a signed payload (`portal_users.id`, org, customer).
3. `requirePortalSession()` on `/api/portal/*` routes loads `portal_users` and scopes all queries to that org + customer (and rollup rules where applicable).
4. `GET /api/portal/bootstrap` supplies shell data (names, logo from `pickPreferredDocumentLogoUrl`, customer company, and **`portalPrimaryColor`** from `organizations.primary_color` when set).
5. `PortalShell` applies `portalAccentCssVariables()` on the portal root so all `/portal/*` pages inherit `--portal-accent*` (same helper as staff preview).
6. Portal pages fetch their data via org-scoped APIs using the portal cookie.

## How preview differs (by design)

| Aspect | Real customer | Staff preview |
| --- | --- | --- |
| Auth | Portal cookie | Dashboard Supabase session (`createServerSupabaseClient`) |
| Entry | Invite / login | `GET /api/portal/preview/start?organizationId=` → redirect |
| Data path | Portal APIs + `requirePortalSession` | Server page uses **service role** only **after** membership checks; queries always filtered by `organizationId` + selected `customerId` |
| UI shell | `PortalSessionProvider` + `PortalShell` | Custom `StaffPortalPreview` (single scrollable page, anchor “nav”) — **not** every sub-route |
| Branding accent | **`organizations.primary_color`** via bootstrap → `PortalShell` (`portal-theme-css.ts`) | Same inline `--portal-accent*` tokens as authenticated portal |
| Actions | Pay, request service, downloads (per rules) | Disabled / explanatory copy; no portal cookie ⇒ no customer API writes |

Preview **does not** bypass tenant isolation: invalid `organizationId` / `customerId` → redirect or empty snapshot; no cross-org reads.

## Access control

- **`staffMayOpenPortalPreview`** (`lib/portal/preview-access.ts`): requires `canManagePortalSettings` (default matrix: **owner** and **admin** only). Managers no longer match the old hard-coded role set — align with Settings → Customer Portal edit permission.
- Enforced in:
  - `app/api/portal/preview/start/route.ts`
  - `app/(portal)/portal/preview/page.tsx`
- Unauthenticated users hitting preview are redirected to staff `/login?next=…` (existing behavior).

## Branding / settings alignment

- **Logo:** Same as bootstrap — `document_logo_url` then `logo_url` (`pickPreferredDocumentLogoUrl`).
- **Accent color:** `organizations.primary_color` → `portalAccentCssVariables()` (`lib/portal/portal-theme-css.ts`) on **preview root** and on **`PortalShell`** after bootstrap loads. If `primary_color` is null/empty, the shell omits inline overrides and **`globals.css`** defaults apply (`#2563eb` family).
- **Certificate / document scope:** `loadStaffPortalPreviewSnapshot` uses `resolvePortalDocumentScope`, `buildPortalDocuments`, `fetchPortalDashboardBundle` — same libraries as portal-facing logic where applicable.

## Public branding API

`GET /api/portal/public-branding?organizationId=` returns `organizationName`, `logoUrl`, and **`primaryColor`**. **`/portal/login?organizationId=<uuid>`** applies those accent variables on the login page only (public, org-scoped; no secrets). Other login entry paths keep global accent until the customer signs in.

## Follow-ups (non-goals for 56.1)

- Full iframe or shared `PortalShell` rendering of every `/portal/*` route under staff auth (large refactor).
- Persisted portal “module toggles” from Settings UI (much of that UI is still local-only).
- Audit log row per preview view (optional env-gated logging).

## Phase 56.1B (real portal accent parity)

Authenticated customers and staff preview now share the same accent variable pipeline; remaining differences are mostly **which route** supplies the hex (bootstrap vs server-rendered org row) and **login** (optional `organizationId` query only).

## Phase 56.2 (settings propagation audit)

Staff **Settings → Customer Portal** only **persists** certificate release default and consolidated document default on **Save**; branding is edited under **Settings → Workspace**. See **`docs/PORTAL_SETTINGS_PROPAGATION.md`** for the full setting matrix and manual checklist.
