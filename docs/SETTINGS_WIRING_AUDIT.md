# Settings wiring audit (Phase 57.2)

This matrix summarizes whether each **Settings** surface persists to the backend, is read-only, or is explicitly **planned / preview** UI. Source of truth for tenant data is **Supabase** (org-scoped tables + RLS); dashboard Route Handlers enforce `requireOrgMemberSession` / `requireOrgPermission` patterns.

**Navigation visibility** is driven by `app/(dashboard)/settings/layout.tsx` (`NAV_ITEMS[].visible` + `getOrgPermissionsForRole`). Server routes remain authoritative for mutations — the UI must not imply saves that APIs do not perform.

| Page / route | Setting or control | Stored where | Save API / action | Permission (nav / typical mutation) | Status |
| --- | --- | --- | --- | --- | --- |
| `/settings/general` | Profile fields (name, phone, job title) | `profiles` (via session) | `PATCH /api/session/profile` | `canManageWorkspaceSettings` (nav) | **Wired** |
| `/settings/general` | Avatar upload / clear | Storage + profile | `POST …/members/{userId}/avatar`, `PATCH /api/session/profile` | Same | **Wired** |
| `/settings/general` | Appearance (light/dark/system) | Local + context (`useWorkspaceAppearance`) | Client preference (not org-wide) | Same | **Wired** (personal, not org DB) |
| `/settings/general` | Password change form | — | — | — | **Removed** (was local-only); replaced with honest copy + link to `/login` |
| `/settings/workspace` | Org name, address, phone, web, timezone, industry, etc. | `organizations` (+ related) | Workspace save handler (see page) | `canManageWorkspaceSettings` | **Wired** |
| `/settings/workspace` | Branding (logo, colors) | Org / storage | Same | Same | **Wired** (gated `canEdit` on page) |
| `/settings/workspace` | Delete workspace | — | Not in app | — | **Read-only** copy; **Contact Equipify** opens site (no fake delete) |
| `/settings/sample-data` | Import / reset sample data | Org content | Sample-data APIs (see page) | `canManageWorkspaceSettings` | **Wired** |
| `/settings/imports` (Migration center) | Import jobs list & actions | `organization_import_jobs` etc. | `/api/organizations/.../imports/...` | `canManageHistoricalImports` | **Wired** |
| `/settings/migration-center` | — | — | Redirects to `/settings/imports` | Same as hub | **Read-only** (alias route) |
| `/settings/imports/*` | Per-source migration wizards | Import tables | Job APIs | Same | **Wired** (per implementation) |
| `/settings/team` | Invites, roles, profiles, skill tags | Memberships / profiles | Team APIs on page | `canManageWorkspaceSettings` | **Wired** |
| `/settings/permissions` | Capability matrix | — | Read-only education UI | `canManageWorkspaceSettings` | **Read-only** |
| `/settings/billing` | Stripe portal, payment methods, plan | Stripe + org billing fields | Billing route handlers | `canViewBilling` / `canEditOrgBilling` for mutations | **Wired** |
| `/settings/ai-usage` | Budget, plan gates, usage display | Org AI usage config + APIs | AI usage PATCH (see page) | `canViewInsights`; edit gated on page | **Wired** |
| `/settings/notifications` | Alert matrix (in-app / email / SMS) | — | — | `canManageWorkspaceSettings` | **Planned** — preview only; toggles **disabled**; no save |
| `/settings/notifications` | Email digest / quiet hours (shell) | — | — | Same | **Planned** — preview only; controls **disabled** |
| `/settings/notifications` | Internal escalation rules | Org settings | `InternalEscalationRulesPanel` APIs | Same | **Wired** |
| `/settings/notifications` | AI Ops digest card | Org AI ops digest (`ai_ops_digest_settings`) | Digest settings/preview/send/runs/test routes | **Phase 57.4:** Routes use `requireOrgPermission` / `requireAnyOrgPermission` (effective capabilities); GET settings/runs need insights **or** workspace settings; PATCH/send/test need `canManageWorkspaceSettings`. UI shows success toast after successful PATCH. | **Wired** |
| `/settings/automations` | Follow-up automation | Org config | `GET/PUT …/follow-up-automation/settings` + evaluate POST | **Phase 57.4:** API allows `canManageAutomations` **or** `canManageWorkspaceSettings` (matches Automations nav); UI `FollowUpAutomationSettingsSection` uses the same OR | **Wired** |
| `/settings/automations` | Workflow automations list/builder | `workflow_automations` (product) | Workflow automation APIs | `canManageAutomations` | **Wired** |
| `/settings/automations` | Reminder email cadence cards | — | — | Same | **Planned** — **preview only**; disabled; no save |
| `/settings/portal` | Portal toggles & copy | Portal / org settings | Portal settings APIs | `canManagePortalSettings` | **Wired** (prior portal phases); review copy for “coming soon” islands |
| `/settings/integrations` | QuickBooks & connectors | Integration tables + OAuth | Connector routes | `canManageIntegrations` | **Wired** where implemented |
| `/settings/integrations` | QuickBooks connection pill | `organization_integrations` | **Phase 57.4:** Hub page `GET …/integrations/quickbooks` for live `connection_status` (Connected / Not connected / error); Stripe card shows **Billing** (not “connected”) | Same | **Wired** (status read-only) |
| `/settings/integrations` | Gmail / other catalog entries | — | — | Same | **Planned** — disabled **No in-app setup yet** (Phase 61.3); readiness badges from `lib/integrations/catalog-metadata.ts` |
| `/settings/integrations/quickbooks` | Connection, sync, auto-sync | QBO integration state | QuickBooks settings APIs | Same | **Wired** (labels reflect server state) |
| `/settings/security` | MFA, sessions, timeout, events | — | — | `canManageSecuritySettings` | **Planned** — non-interactive honesty page (Phase 57.2) |
| `/settings/api` | API keys / outbound webhooks | — | — | `canManageApiKeys` | **Planned** — honesty shell (Phase 61.2); roadmap + link to `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`; no keys / no registrations |
| `/settings/audit-log` | Audit entries | Audit log tables | Read APIs | `canViewOperationalReports` or `canManageSecuritySettings` | **Wired** (read) |
| `/settings/archived` | Archived records restore | Archive tables | Restore actions on page | `canArchiveRecords` | **Wired** |
| `/settings/equipment-types` | Equipment types CRUD | Org equipment types | CRUD APIs on page | `canManageWorkspaceSettings` | **Wired** |

## Permission notes

- **Do not** infer permissions from UI alone; Route Handlers re-check capabilities.
- **Security** and **API / Developers** nav items use `canManageSecuritySettings` and `canManageApiKeys` respectively — narrower than full workspace admin in some org configurations.
- **Migration center** is **`canManageHistoricalImports`** (owner/admin-style), not general workspace settings.

## Follow-up (out of scope for 57.2)

- Persist personal notification channel preferences behind a dedicated API.
- Replace reminder cadence preview with a stored model or remove until product definition is fixed.
- Implement Supabase-backed MFA / session management when ready, then re-enable interactive Security settings.
- Implement real API keys + outbound webhooks with audit trail and rotation (see `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`).

## Changelog

- **Phase 57.2:** Removed misleading password form, demo Security page, demo API keys, fake notification/automation saves; added this document.
- **Phase 57.4:** Follow-up automation API/UI aligned on `canManageAutomations | canManageWorkspaceSettings`; AI Ops digest APIs aligned on `requireOrgPermission` (effective caps) + digest save toast; Integrations hub shows real QuickBooks connection status and honest Stripe label.
- **Phase 61.2:** Added `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md` (future public API + outbound webhooks); `/settings/api` expanded copy + doc links; scaffolding `lib/api/future-webhook-event-types.ts` (unused event name constants).
- **Phase 61.3:** Integration catalog accuracy — `docs/INTEGRATION_CATALOG_INVENTORY.md`, shared `lib/integrations/catalog-metadata.ts`; product `/integrations` aligns QuickBooks (live), Stripe billing (limited), Fuzor (beta external); roadmap **Planned** + honest interest/request modals; settings hub removes fake Docs / “Connect (coming soon)” stubs.
