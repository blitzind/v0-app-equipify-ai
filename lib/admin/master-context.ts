/**
 * Equipify Master Context Doc — narrative sections are maintained here.
 * Repository inventory is injected from `master-context.generated.ts` (see `pnpm update:master-context`).
 * TODO: Optionally automate deeper schema/route introspection; keep secrets out of this file.
 */
import { MCG_SCAN_SECTION } from "./master-context.generated"

/** Updated by `scripts/update-master-context.ts` alongside generated scan output. */
export const MASTER_CONTEXT_LAST_UPDATED_ISO = "2026-05-08T17:27:58.729Z"

function formatUtc(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`
  } catch {
    return iso
  }
}

/**
 * Full Markdown document for ChatGPT / GPT project planning. No secrets or env values.
 */
export function getEquipifyMasterContext(): string {
  return `# Equipify Master Context Doc

## Last Updated
${formatUtc(MASTER_CONTEXT_LAST_UPDATED_ISO)}

## Project Overview
Equipify.ai is a multi-tenant field-service operations platform for commercial equipment businesses: customers, assets (equipment), work orders, scheduling, maintenance plans, quotes/invoices, inventory/parts, technician workflows, certificates/calibration, customer portal, and platform admin. The staff app targets dispatchers, technicians, and back-office roles; the portal targets customer contacts.

## Tech Stack
- **Framework:** Next.js (App Router), React 19, TypeScript.
- **Styling:** Tailwind CSS v4, shadcn-style \`components/ui\`, \`class-variance-authority\`, \`tailwind-merge\`.
- **Backend / data:** Supabase (PostgreSQL, Row Level Security, Auth, Storage). Server automation uses the **service role** only in trusted Route Handlers and cron jobs — never expose service keys to the client.
- **Auth:** Supabase Auth sessions; middleware refreshes session; dashboard routes protected; portal uses signed cookie session (\`/portal/*\`).
- **Billing:** Stripe (checkout + webhooks), plan entitlements and usage limits in app logic.
- **Deploy:** Vercel (\`vercel.json\` cron schedules). Analytics: Vercel Analytics package present.
- **Integrations (product):** QuickBooks Online OAuth + export sync (customers, catalog items, invoices) + optional invoice auto-sync; many other integrations listed on the marketing-style Integrations page are placeholders.

## App Architecture
- **Route groups:** \`app/(dashboard)\` staff UI; \`app/(portal)\` customer portal; \`app/(admin)\` platform admin (\`/admin/*\`), gated by platform-admin identity server-side.
- **Layouts:** Dashboard uses main product shell (sidebar, top bar); portal uses portal shell; admin uses \`AdminWorkspaceShell\` + dark admin headers on individual pages.
- **Middleware:** Session refresh; dashboard path prefixes protected; \`/portal/*\` uses portal cookie gate (except login); \`/admin\` loads only for platform admins (layout redirect).
- **Tenant handling:** Active organization from membership (\`organization_members\`) + profile default org; almost all domain rows are scoped by \`organization_id\`.

## Multi-Tenant Data Model
- **Organizations:** \`organizations\` — tenant root; branding/workspace settings on org rows and related tables.
- **Profiles:** \`profiles\` linked to \`auth.users\`; optional \`default_organization_id\`.
- **Memberships:** \`organization_members\` composite key \`(organization_id, user_id)\` with **database roles** \`owner\` | \`admin\` | \`manager\` | \`tech\` | \`viewer\` and status \`invited\` | \`active\` | \`suspended\`.
- **Tenant boundary:** Foreign keys and \`organization_id\` columns; **RLS** policies use helpers like \`is_org_member(org_id)\` and \`has_org_role(org_id, roles[])\`. APIs typically verify membership before returning or mutating data.
- **Assumptions:** No cross-tenant reads from user sessions; privileged automation uses service role after explicit checks.

## Implemented Modules

### Dashboard
- **Route:** \`/\`
- **Purpose:** Operational overview (KPIs, shortcuts).
- **Status:** Implemented (tenant-aware).
- **Key UI:** Dashboard tiles, mobile technician snapshot where applicable.
- **Data/API:** Reads via Supabase client + org scope.
- **Gaps:** KPI definitions evolve; ensure parity with billing/analytics APIs.

### Customers
- **Routes:** \`/customers\`, \`/customers/[id]\`
- **Purpose:** Accounts, contacts, locations, archive patterns.
- **Status:** Implemented.
- **Key UI:** Customer drawers, lists.
- **Tables:** \`customers\`, \`customer_contacts\`, \`customer_locations\`.
- **Gaps:** Parent/child hierarchy, CSV import, billing-address sophistication (see Priorities).

### Equipment
- **Routes:** \`/equipment\`, \`/equipment/[id]\`
- **Purpose:** Asset registry, categories, warranty fields.
- **Status:** Implemented.
- **Tables:** \`equipment\` (+ migrations for warranty/metadata).
- **Gaps:** Deeper equipment-type reporting and history rollups.

### Work Orders
- **Routes:** \`/work-orders\`, \`/work-orders/[id]\`
- **Purpose:** Full WO lifecycle — scheduling, assignment, labor/parts, attachments, signatures, certificates linkage.
- **Status:** Implemented (large surface area).
- **Key UI:** \`work-order-detail-experience\`, drawers, certificate tabs.
- **Tables:** \`work_orders\` (+ many additive columns), related tasks/parts/attachments migrations.
- **Gaps:** Service-to-invoice linkage polish, dispatch scheduling edge cases.

### Service Schedule
- **Route:** \`/service-schedule\`
- **Purpose:** Calendar-oriented upcoming maintenance / service view.
- **Status:** Implemented.
- **Gaps:** Filtering, unassigned work UX, tighter integration with dispatch.

### Maintenance Plans
- **Routes:** \`/maintenance-plans\`, related dialogs.
- **Purpose:** Recurring PM; automated WO creation when due.
- **Status:** Implemented; cron drives due processing (\`/api/cron/maintenance-due\`).
- **Tables:** maintenance plan tables + automation engine migrations.
- **Gaps:** Complex recurrence edge cases; notification tuning.

### Technicians
- **Routes:** \`/technicians\`, \`/technicians/today\`, \`/technicians/daily\`
- **Purpose:** Roster, certifications, field UX.
- **Status:** Implemented (operational technician table + UI).
- **Gaps:** Permissions refinements for field-only users.

### Certificates (calibration)
- **Routes:** \`/calibration-templates\` (nav label “Certificates”), WO certificate tabs.
- **Purpose:** Templates (\`calibration_templates\`), per-WO records (\`calibration_records\`), PDF/HTML output.
- **Status:** MVP complete; portal exposes certificates API.
- **Gaps:** Attachments, customer release rules, technician signature workflows.

### Quotes
- **Route:** \`/quotes\`
- **Purpose:** Quote authoring and customer approval flows (incl. portal).
- **Tables:** \`org_quotes\` family.
- **Gaps:** Terms-driven due dates; tax logic.

### Invoices
- **Route:** \`/invoices\`
- **Purpose:** Invoicing, send email routes, QuickBooks export when connected.
- **Tables:** \`org_invoices\` family.
- **Gaps:** Payment allocation vs QB; automatic due dates; jurisdiction tax.

### Purchase Orders & Vendors
- **Routes:** \`/purchase-orders\`, \`/vendors\`
- **Status:** Implemented.
- **Tables:** \`org_purchase_orders\`, \`org_vendors\`.

### Inventory
- **Route:** \`/inventory\`
- **Purpose:** Stock, locations, allocate/receive/consume/transfer/adjust, low stock.
- **Status:** Implemented (many \`/api/organizations/.../inventory/*\` routes).
- **Gaps:** Operational polish, reorder workflows.

### Catalog & imports
- **Routes:** \`/catalog\`, \`/catalog/import\`; APIs for \`catalog_items\`, \`price_list_imports\`, AI extraction jobs.
- **Status:** Implemented with AI-assisted import pipeline.
- **Gaps:** Verification UX at scale.

### Reports
- **Route:** \`/reports\`
- **Purpose:** Analytics exports / reporting UI.
- **Status:** Implemented with org analytics API support.
- **Gaps:** Deeper equipment-type reporting.

### Insights & AI Assistants
- **Routes:** \`/insights\`, \`/ai-assistants\`
- **Purpose:** AI insights generation; operational assistants; job queue processing.
- **Status:** Implemented; cron processes AI jobs.
- **Gaps:** Plan/budget gating UX; task coverage.

### Communications
- **Route:** \`/communications\`
- **Purpose:** Communication events, templates, metrics, automations.
- **Status:** Implemented.

### Settings
- **Routes:** \`/settings/*\` (workspace, team, billing, portal, QuickBooks sub-route, etc.)
- **Purpose:** Org configuration, branding, invites, permissions matrix (documentation), automation hooks.
- **Status:** Broad coverage.
- **Gaps:** Live fine-grained RBAC beyond DB roles (see Permissions).

### Integrations (in-app)
- **Routes:** \`/integrations\`, \`/settings/integrations\`, \`/settings/integrations/quickbooks\`
- **Purpose:** Integration catalog + real QuickBooks admin surface.
- **Status:** QuickBooks connection + sync implemented; catalog page may still list some vendors as “coming soon”.
- **Gaps:** Align marketing copy with actual connectors.

### Customer portal
- **Routes:** \`/portal/*\` (login, dashboard, equipment, work orders, invoices, quotes, certificates, maintenance, etc.)
- **Purpose:** Customer self-service via magic-link / portal session.
- **Status:** Core flows implemented; APIs under \`/api/portal/*\`.
- **Gaps:** Portal reports page still mock/demo in places; document library access.

### Platform admin
- **Routes:** \`/admin\`, \`/admin/ai-operations\`, \`/admin/master-context\`
- **Purpose:** Cross-tenant operations (accounts, AI ops, internal context doc).
- **Status:** Implemented (platform APIs under \`/api/platform/*\`).

## Current Workflow Map
1. **Customer** record → **locations** & **contacts**.
2. **Equipment** installed at customer/location context.
3. **Work order** created (ad hoc or from **maintenance plan** / schedule).
4. **Schedule / dispatch** assigns technician and time (\`scheduled_on\` / dispatch UI).
5. Field completion → **certificate / calibration** data on WO when applicable; documents (PDF/HTML) from templates.
6. **Invoice** (and **quote** earlier in sales flow); optional **QuickBooks** export + auto-sync.
7. **Portal** visibility for customer-facing statuses; **payments** via Stripe/billing flows (org configuration).
8. **Maintenance plans:** cron detects due plans → creates WO → advances schedule → may emit workflow automations.

## Database Schema Summary
- **Core tenant:** \`organizations\`, \`profiles\`, \`organization_members\`.
- **CRM / assets:** \`customers\`, \`customer_contacts\`, \`customer_locations\`, \`equipment\`.
- **Operations:** \`work_orders\` (+ tasks/parts/attachments-related migrations), \`technicians\` (operational), maintenance plan tables.
- **Financial docs:** org quotes/invoices + numbering migrations.
- **Catalog:** \`catalog_items\`, \`price_list_imports\`.
- **Certificates:** \`calibration_templates\`, \`calibration_records\`.
- **Automation:** \`workflow_automations\`, \`workflow_runs\`, \`workflow_run_logs\`; communications tables; AI jobs/usage logs.
- **Integrations:** \`organization_integrations\`, OAuth tokens, \`quickbooks_sync_logs\`, \`external_sync_mappings\`.
- **Portal:** \`portal_users\`, \`portal_access_links\`, \`portal_activity_logs\`.
- **Billing:** \`organization_subscriptions\`, Stripe webhook tables, usage/API metering migrations.
- **Inventory:** inventory migrations (\`20260711120000_inventory_parts_tracking.sql\` etc.).
- **RLS:** Enabled on tenant tables; policies generally deny broad anon access; service role used deliberately from trusted servers.

Do **not** paste Supabase URLs, anon/service keys, OAuth secrets, or Stripe secrets into GPT contexts.

## API Routes Summary
Organized Route Handlers under \`app/api\`: **organization-scoped** JSON APIs at \`/api/organizations/[organizationId]/...\` for workspace, catalog, inventory, communications, workflows, AI, QuickBooks, calibration import, customers/locations, portal invites, reports, etc.; **portal** APIs at \`/api/portal/...\`; **platform admin** at \`/api/platform/...\`; **cron** at \`/api/cron/...\` (secret-protected); **webhooks** (\`/api/stripe/webhook\`); **email** helpers; **session/team/invites**; **integrations/quickbooks** OAuth. Exact file list and counts are auto-generated below.

${MCG_SCAN_SECTION}

## QuickBooks Integration Status
- **Connection:** OAuth (\`/api/integrations/quickbooks/authorize\`, \`/callback\`); tokens in \`organization_integration_oauth_tokens\`; refresh handled server-side.
- **Sync direction:** Primarily **export** to QBO — customers, catalog items, invoices; mappings in \`external_sync_mappings\`; logs in \`quickbooks_sync_logs\`.
- **Settings:** Org integration row supports \`sync_settings\` (e.g. \`auto_sync_invoices\`); UI under **Settings → Integrations → QuickBooks**.
- **Auto-sync:** Non-blocking invoice export when enabled after invoice events.
- **Gaps:** Import/sync back from QBO limited vs export-first design; production Intuit credentials and error UX rely on sync logs; generic Integrations marketing page may say “coming soon” while QBO is live under Settings.

## Certificate System Status
- **Templates:** \`/calibration-templates\`; JSON field definitions; archive support.
- **Import:** APIs for template import commit / certificate template import routes.
- **WO linkage:** \`calibration_records\` per work order; optional \`calibration_template_id\` on WO.
- **Output:** HTML/PDF generation utilities (\`lib/calibration-certificates\`, document HTML helpers); branding uses workspace logos where configured.
- **Signatures:** Customer signature capture exists on WO flows; technician signature / release rules still evolving.
- **Gaps:** Attachment storage policies, customer release workflows, stronger signature audit trail.

## Scheduling Status
- **Service schedule & dispatch:** Dispatch board and service schedule pages; drawers for scheduling; WO \`scheduled_on\` / time fields.
- **Unassigned / filters:** Partially implemented — verify edge cases for unscheduled backlog.
- **Relationship:** WOs are the primary scheduled entity; maintenance automation creates WOs on due dates.
- **Gaps:** Performance at scale, conflict detection, mobile parity.

## Customer Hierarchy Status
- **Today:** Customers with multiple **locations** and **contacts**; flat customer model with org scope.
- **Needed:** Parent/child account hierarchy, multi-entity billing, consolidated reporting — not fully modeled.

## Permissions and Roles Status
- **Database roles:** \`owner\`, \`admin\`, \`manager\`, \`tech\`, \`viewer\` on \`organization_members\`.
- **Server enforcement:** Membership checks on APIs; RLS; some routes require owner/admin (e.g. branding uploads).
- **UI:** Team settings reflect DB roles; a static permissions matrix page is informational; demo **TenantProvider** \`can()\` helpers can diverge from live membership — treat **server checks + RLS** as source of truth.
- **Needed:** Product-level “billing-only” / “sales” style roles aligned with DB; optional migration from viewer/manager semantics to commercial role names.

## UI/UX Standards
- **Brand:** Primary blue (\`--primary\`, \`--status-info\` ~ **#0f7ae5**); **CTA orange** \`--cta\` **#f59f1c** for primary filled actions; **AI accent** aligns with brand blue (\`--ai-purple\`).
- **Dark chrome:** Admin header uses **#0F172A**; app sidebar dark navy per \`globals.css\` (\`--sidebar\` / **#08111f** tones).
- **Components:** Prefer \`components/ui\` patterns; tables + cards for dense data; **drawers/sheets** for create/edit flows.
- **Mobile:** Bottom nav and technician-oriented compact layouts on select routes.
- **Data display:** Avoid showing raw UUIDs in primary UI — prefer human labels, numbers, slugs.
- **Icons:** Sidebar modules use consistent lucide icons / module icon helpers.
- **Accessibility:** Semantic headings, focus rings (\`--ring\`), sufficient contrast; prefer Radix primitives from \`components/ui\`.

## Known Limitations / Technical Debt
- Demo/mock layers (\`tenant-store\`, some portal pages) can drift from production RBAC.
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
- **California / location-based tax** logic
- **Equipment history** and **equipment-type reporting**
- **Certificate attachments** and customer **release rules**
- **Technician signature** handling
- Customer **portal document** access
- Historical migration from **QuickBooks / FieldPulse**
- **Role and permission** controls (commercial roles vs DB enums)
- **Scheduling / dispatch** improvements
- **Inventory / parts** tracking depth

## Prompting Instructions for GPT
Use this context to create implementation prompts that preserve existing architecture, avoid duplicate systems, follow current UI patterns, and sequence work in safe phases. Never ask GPT to embed secrets; prefer referencing env var **names** only. After meaningful commits, run \`pnpm update:master-context\` so inventory sections stay accurate.

---

*Manual sections live in \`lib/admin/master-context.ts\`; repository inventory is generated into \`lib/admin/master-context.generated.ts\`.*
`
}
