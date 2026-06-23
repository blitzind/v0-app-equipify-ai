## QuickBooks Integration Status
- **Connection:** OAuth (`/api/integrations/quickbooks/authorize`, `/callback`); tokens in `organization_integration_oauth_tokens`; refresh handled server-side.
- **Sync direction:** Primarily **export** to QBO — customers, catalog items, invoices; mappings in `external_sync_mappings`; logs in `quickbooks_sync_logs`.
- **Settings:** Org integration row supports `sync_settings` (e.g. `auto_sync_invoices`); UI under **Settings → Integrations → QuickBooks**.
- **Auto-sync:** Non-blocking invoice export when enabled after invoice events.
- **Gaps:** Import/sync back from QBO limited vs export-first design; production Intuit credentials and error UX rely on sync logs; generic Integrations marketing page may say “coming soon” while QBO is live under Settings.

## Certificate System Status
- **Templates:** `/calibration-templates`; JSON field definitions; archive support.
- **Import:** APIs for template import commit / certificate template import routes.
- **WO linkage:** `calibration_records` per work order; optional `calibration_template_id` on WO.
- **Output:** HTML/PDF generation utilities (`lib/calibration-certificates`, document HTML helpers); branding uses workspace logos where configured.
- **Signatures:** Customer signature capture exists on WO flows; generated certificates prefer fresh technician visit signatures, fall back to stored technician profile signatures, then show an explicit fallback/unsigned state.
- **Gaps:** Attachment storage policy hardening and deeper signature usage analytics.

## Scheduling Status
- **Service schedule & dispatch:** Dispatch board and service schedule pages; drawers for scheduling; WO `scheduled_on` / time fields.
- **Unassigned / filters:** Partially implemented — verify edge cases for unscheduled backlog.
- **Relationship:** WOs are the primary scheduled entity; maintenance automation creates WOs on due dates.
- **Gaps:** Performance at scale, conflict detection, mobile parity.

## Customer Hierarchy Status
- **Today:** Customers with multiple **locations** and **contacts**; flat customer model with org scope.
- **Needed:** Parent/child account hierarchy, multi-entity billing, consolidated reporting — not fully modeled.

## Permissions and Roles Status
- **Database roles:** `owner`, `admin`, `manager`, `tech`, `viewer` on `organization_members`.
- **Commercial profiles:** Optional `organization_members.permission_profile` overlays support Owner, Admin, Operations Manager, Technician, Billing, Sales / Prospects, and Viewer without replacing the DB role enum. `permissions_json` stores optional boolean capability overrides for application/API guards.
- **Server enforcement:** RLS remains the tenant boundary; APIs use `requireOrgPermission` / `getEffectiveOrgPermissions` for capability checks. Sensitive areas such as certificate release, reports, attachment mutation, billing/settings, imports, and team management should gate mutations through capabilities.
- **Technician access:** Technician profile defaults include `canUseTechnicianWorkspace` and `canViewAssignedWorkOrdersOnly`; the dashboard, sidebar/mobile nav, work-order list, and schedule views prioritize assigned field work and hide financial/admin/dispatch controls unless additional capabilities are granted.
- **UI:** Team settings show DB role, optional permission profile, and an access preview; Settings → Permissions is generated from the shared capability map. Demo **TenantProvider** `can()` helpers can still diverge from live membership — treat **server checks + RLS** as source of truth.

## UI/UX Standards
- **Inline empty & errors (dropdowns, table footers, compact panels):** Use a muted or semantic icon, one-line title, and short helper text. When a request can be retried, pair the message with an outline **Retry** button (`Button` `variant="outline"` `size="sm"`). Avoid raw API strings as the only copy — add context or a next step where feasible.
- **Brand:** Primary blue (`--primary`, `--status-info` ~ **#0f7ae5**); **CTA orange** `--cta` **#f59f1c** for primary filled actions; **AI accent** aligns with brand blue (`--ai-purple`).
- **Dark chrome:** Admin header uses **#0F172A**; app sidebar dark navy per `globals.css` (`--sidebar` / **#08111f** tones).
- **Components:** Prefer `components/ui` patterns; tables + cards for dense data; **drawers/sheets** for create/edit flows.
- **Mobile:** Bottom nav and technician-oriented compact layouts on select routes.
- **Data display:** Avoid showing raw UUIDs in primary UI — prefer human labels, numbers, slugs.
- **Icons:** Sidebar modules use consistent lucide icons / module icon helpers.
- **Accessibility:** Semantic headings, focus rings (`--ring`), sufficient contrast; prefer Radix primitives from `components/ui`.

## Known Limitations / Technical Debt
- **Growth Engine autonomy batch (GE-AUTO-1A–2I):** implemented locally, **not committed/deployed** as of 2026-06-23. Production autonomy cert verdict: `GROWTH_ENGINE_AUTONOMY_READY_WITH_MINOR_FOLLOWUPS`. Autonomous outbound **not** broadly enabled; autonomous approvals **disabled**; default autonomous daily budgets **0**. See **Growth Engine Autonomy System** section in master context for enablement checklist. GE-AUTO-3 **not started**.
- Growth outbound operational send plane v1 + internal outbound ops Phase 1 (`growth-internal-outbound-ops-v1`): live Google mailbox + transport orchestrator; internal ops center at `/admin/growth/infrastructure/outbound-operations`; Microsoft preview-only; warmup execution disabled; unified pre-send gate with infrastructure guards; DNS manual verification only. See `docs/GROWTH_OUTBOUND_OPERATIONAL_READINESS.md`.
- Demo/mock layers (`tenant-store`, some portal pages) can drift from production RBAC.
- Settings surfaces: **personal** notification channel preferences and static reminder cadence cards are **not** persisted until dedicated APIs exist — workspace alert/digest/quiet prefs use `notification-preferences` — see `docs/SETTINGS_WIRING_AUDIT.md`.
- Capability enforcement: some routes (e.g. parts of Communications / AI-Ops) still use raw `organization_members.role` branching; Settings nav intentionally uses role-default permissions — see `docs/PERMISSIONS_ENFORCEMENT_AUDIT.md`.
- Integrations hub vs Settings connector truth mismatch for QuickBooks marketing status.
- Workflow trigger coverage must stay aligned with DB constraint migrations.
- Portal reports section partially mock until wired to live aggregates.
- Generated scan script lists files — behavior summaries remain manual.

## Current Priorities
Roadmap informed by product direction (keep sequencing flexible):
- Customer **CSV import**
- **Parent/child** customer hierarchy
- **Service-to-invoice** linkage hardening
- Automatic **terms-based due dates**
- **US jurisdiction / location-based tax** logic
- Portal-facing equipment history
- **Certificate attachments** and customer **release rules**
- **Technician signature** usage analytics
- Customer **portal document** access
- Historical migration from **QuickBooks / FieldPulse**
- **Role and permission** controls (commercial roles vs DB enums)
- **Scheduling / dispatch** improvements
- **Inventory / parts** tracking depth

## Prompting Instructions for GPT
Use this context to create implementation prompts that preserve existing architecture, avoid duplicate systems, follow current UI patterns, and sequence work in safe phases. Never ask GPT to embed secrets; prefer referencing env var **names** only. After meaningful commits, run `pnpm update:master-context` so inventory sections stay accurate.

---

*Manual sections live in `lib/admin/master-context.manual.before.md` and `lib/admin/master-context.manual.after.md`; repository inventory is generated into `lib/admin/master-context.generated.ts`.*
