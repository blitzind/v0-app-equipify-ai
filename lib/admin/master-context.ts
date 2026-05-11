/**
 * Equipify Master Context Doc — narrative sections are maintained here.
 * Repository inventory is injected from `master-context.generated.ts` (see `pnpm update:master-context`).
 * TODO: Optionally automate deeper schema/route introspection; keep secrets out of this file.
 */
import { MCG_SCAN_SECTION } from "./master-context.generated"

/** Updated by `scripts/update-master-context.ts` alongside generated scan output. */
export const MASTER_CONTEXT_LAST_UPDATED_ISO = "2026-05-11T00:57:48.453Z"

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
- **Integrations (product):** QuickBooks Online OAuth + export sync (customers, catalog items, invoices) + optional invoice auto-sync; Stripe **billing** lives under Settings → Billing (not a generic tenant “Stripe Connect”); marketing **Integrations** catalog uses **Live / Limited / Beta / Planned** labels from \`lib/integrations/catalog-metadata.ts\` — see \`docs/INTEGRATION_CATALOG_INVENTORY.md\`; **no Gmail OAuth** in app code today (\`docs/GMAIL_INTEGRATION.md\`).

## App Architecture
- **Route groups:** \`app/(dashboard)\` staff UI; \`app/(portal)\` customer portal; \`app/(admin)\` platform admin (\`/admin/*\`), gated by platform-admin identity server-side.
- **Layouts:** Dashboard uses main product shell (sidebar, top bar); portal uses portal shell; admin uses \`AdminWorkspaceShell\` + dark admin headers on individual pages.
- **Middleware:** Session refresh; dashboard path prefixes protected; \`/portal/*\` uses portal cookie gate (except login); \`/admin\` loads only for platform admins (layout redirect).
- **Tenant handling:** Active organization from membership (\`organization_members\`) + profile default org; almost all domain rows are scoped by \`organization_id\`.
- **Phase 57.1 — Header search:** Desktop top bar uses \`GlobalSearchHeader\` → \`GET /api/organizations/{organizationId}/global-search?q=\` with \`requireOrgMemberSession\` and \`runOrgGlobalSearch\` (\`lib/global-search/run-global-search.ts\`). Results are grouped (customers, equipment, work orders; invoices if \`canViewFinancials\`; quotes if \`canViewQuotes\`; maintenance plans if \`canManageDispatch\`; roster profiles if technician permissions). Technician assigned-only scope uses \`loadAssignedWorkScope\` for customers/equipment/work orders. Mobile header has no search field (avoid non-functional stub).
- **Phase 57.2 — Settings wiring honesty:** See \`docs/SETTINGS_WIRING_AUDIT.md\` for the full matrix. High-signal changes: \`/settings/security\` and \`/settings/api\` no longer show interactive demo MFA, sessions, or fake API keys; \`/settings/general\` drops a non-functional password form; \`/settings/notifications\` personal channel matrix and digest/quiet shells are read-only previews; \`/settings/automations\` “Reminder emails” cadence cards are preview-only (persisted automation is Follow-up + Workflow sections). Workspace “Contact support” links out instead of a disabled stub.
- **Phase 57.3 — Permission enforcement alignment:** See \`docs/PERMISSIONS_ENFORCEMENT_AUDIT.md\`. Server gates now use \`getOrganizationMemberRecord\` + effective capabilities for **staff portal preview**; **portal invites** require \`canManagePortalSettings\` (not a loose manager role list); **workspace PATCH** uses \`canManageWorkspaceSettings\` (fixes manager vs owner/admin-only raw check); **default invoice terms** GET/PATCH use financial/billing capabilities. Legacy \`requireOrgMemberPermission\` (rarely used) resolves effective permissions.
- **Phase 57.4 — Settings wiring sprint:** See \`docs/SETTINGS_WIRING_AUDIT.md\` changelog. **Follow-up automation** settings + evaluate APIs accept \`canManageAutomations\` **or** \`canManageWorkspaceSettings\` (UI matches). **AI Ops digest** Route Handlers use \`requireOrgPermission\` / \`requireAnyOrgPermission\` instead of raw-role checks; digest PATCH shows an honest saved toast. **Integrations** hub fetches QuickBooks \`connection_status\` for a real Connected/Not connected pill; Stripe remains labeled as billing-only.
- **Phase 57.5 — UI consistency polish:** Tightened inline empty/error patterns in high-traffic surfaces (global search panel, notifications dropdown, work order tasks card, reports analytics banner, technicians table empty row). Prefer icon + short title + helper line; for recoverable fetch failures add **Retry** next to the message. Full-page empty states continue to use \`components/ui/empty.tsx\` where already adopted.
- **Phase 58.1 — Inventory workflow UX:** \`/inventory\` explains that **catalog items** (SKUs) are added/edited under \`/catalog\`; stock movements use capability-aligned controls (\`canManageInventory\` for receive/transfer/locations/thresholds/van assignment; \`canAdjustInventoryStock\` plus manage for adjustments; \`canConsumePartsOnWorkOrders\` for consume). Tab labels: Adjust/receive, Transfer stock, Consume parts & history, Van & truck stock, Reorder. **Archive item** on the catalog drawer confirms before hiding a SKU (no hard delete). Client no longer infers manage rights from raw manager roles alone for inventory mutations — it follows \`useOrgPermissions\` + platform admin. **Catalog ↔ Inventory bridge:** the catalog item drawer Overview tab includes **Manage stock quantities** (permission-gated) with links to \`/inventory?tab=…&itemId=…\`; \`tab=stock\` is accepted as an alias for the Overview on-hand table. Deep-link pre-fills receive/adjust/transfer/consume pickers when the catalog id is in the loaded catalog list.
- **Phase 58.2 — Inventory operational validation:** \`requireOrgCatalogWrite\` / \`requireOrgInventoryWrite\` now use **effective** org permissions (same basis as \`requireOrgPermission\`), so catalog/inventory API gates honor \`permission_profile\` / \`permissions_json\`. **Restock request** enforces truck-only \`location_id\` for users without \`canManageInventory\`, and ledger \`quantity\` is always positive (DB constraint) — open-ended requests use nominal qty \`1\` with metadata. **Allocate/deallocate** validate location (and deallocate validates WO/catalog) org scope. **Vehicle stock** assignment requires a **vehicle** location type. Ledger API returns \`created_by\`; staff ledger table shows part, primary bin, and transfer counterparty bin names.
- **Phase 59.1 — Full-page work order Save offline parity:** On \`/work-orders/[id]\`, **Save** while offline queues only **technician-safe** fields into the same per-user per-work-order IndexedDB/localStorage bundle as the drawer (\`mergeTechnicianOfflineBundle\`, manual **Sync now**, conflict flow unchanged). Queued offline: problem text, diagnosis, technician notes, internal notes, JSON \`repair_log\` tasks when the org does **not** use server-backed task rows. **Not** queued offline: labor hours, parts lines, totals/billing, AI, signatures, QuickBooks, inventory, and broad status changes (except Open/Scheduled → In progress via the existing offline status control). If the user also edited labor/parts/signature, Save still queues safe fields once, shows one clear toast (no destructive + success stack), **keeps edit mode** until those online-only edits are saved or reverted, and shows inline copy that labor/parts/signatures need a connection. UI copy lives in \`lib/sync-prep/constants.ts\` (\`SYNC_PREP_COPY.workOrderFullPage*\`).
- **Phase 59.2 — Offline technician photos (work orders):** JPEG/PNG/WebP/GIF can be **queued on-device** (IndexedDB \`pendingPhotoBlobs\` + \`payload.pendingPhotos\` on the existing outbox row) from the work order drawer and full page; **Sync now** runs \`uploadWorkOrderAttachment\` for each queued blob **before** the repair/status patch. Limits: 24 images / scope, 10 MiB each (stricter than server 15 MiB). PDFs, Word/Excel, linked org documents (\`DocumentAttachmentsPanel\`), certificates, portal release, and signatures remain **online-only** — mixed file picks offline skip non-images with a clear toast. Discard local draft deletes blobs; no tokens stored locally. IndexedDB DB version bumped to **2** (\`equipify-work-order-offline-v1\`).
- **Phase 59.3 — Offline operational validation (work orders):** Hardening only — no new offline domains. **Replay races:** \`Sync now\` uses an in-tab ref guard plus \`navigator.locks\` per scope (\`withWorkOrderOfflineReplayLock\`) so double-clicks and cross-tab replay do not run two uploads/patches in parallel; replay reads the latest outbox row after marking \`syncing\`. **Merge races:** \`putOfflineBundleMergePatch\` retries when the stored row changes underfoot and **refuses** writes while status is \`syncing\` or \`conflict\` (clear toasts via \`SYNC_PREP_COPY.workOrderOfflineQueueBlocked*\`). **Multi-tab visibility:** \`bumpWorkOrderOfflineListeners\` also writes a tiny \`localStorage\` timestamp (\`WORK_ORDER_OFFLINE_BUMP_LS_KEY\`); \`subscribeWorkOrderOfflineBump\` listens for \`storage\` so other tabs refresh digest/previews without relying on same-tab \`CustomEvent\` alone. **Stale replay writes:** \`replay-drawer\` persists failures using a **fresh** \`getWorkOrderOfflineRecordForScope\` read so partial photo upload or DB errors do not clobber concurrent local edits. **Diagnostics:** \`lastSyncAttemptAtIso\` on the outbox row when entering \`syncing\`; sync bar shows last attempt time, raw \`lastError\`, “stored on this device”, and friendlier copy for access/RLS-style failures (\`formatWorkOrderOfflineReplayError\`). **IndexedDB:** dev-only \`console.debug\` on IDB/localStorage failures in \`idb-store\`; text bundle still falls back to **small** JSON in \`localStorage\`; photo blobs **never** go to localStorage — blob store failure blocks queuing (existing Phase 59.2 behavior). **Assignment/access loss:** replay surfaces “not found / access denied” and permission-style errors without leaking other org data; local draft remains until discard or successful sync. **Manual QA checklist** and failure modes: see \`docs/WORK_ORDER_OFFLINE_OPERATIONAL_VALIDATION.md\`.
- **Phase 59.4 — Offline UX refinement (work orders):** Copy and layout only. Centralized strings in \`SYNC_PREP_COPY\` (clearer **online / offline / needs sync / syncing / paused** language; softer conflict and failure tone; **Save on this device** when offline on full page). **Sync bar** (\`work-order-offline-sync-bar\`): relative “saved on device” time via \`formatOfflineRelativeUpdated\` (\`offline-relative-time.ts\`); connected vs offline icons; **Clear device draft** with tooltip; conflict toast non-alarming. **Mobile banner** (\`work-order-sync-prep-banner\`): tighter padding, status line includes queued photo count from digest. **Conflict dialog:** calmer title/footer, **Done for now** / **Clear draft on this device** (outline) instead of harsh destructive-only pattern. **Pending photo previews:** larger touch remove on small screens, shared section labels from constants. **Technician quick bar:** \`networkOnline\` switches Wi‑Fi icon + online vs offline lead copy. **Badge** (\`online-required-badge\`): \`syncing\` mode; conflict/failed use amber rather than red. No new storage, APIs, or conflict rules.
- **Phase 60.1 — Plan entitlement enforcement audit:** Documented subscription resolution, **permissions vs entitlements**, and an enforcement matrix in \`docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md\`. Architecture: \`organization_subscriptions\` + webhooks; \`getEffectivePlanId\` / \`canUseFeature\` / \`requireCanCreateRecord\` / \`requireFeatureAccess\`; billing UX via \`getBillingAccessState\` (\`lib/billing/access.ts\`). **Surgical fix:** AI Ops digest **send**, **preview**, and **test-destination** plus **recommendations** list and **execute-action** now call \`requireFeatureAccess(..., "ai")\` (Growth+), with **platform admin** bypass preserved on recommendations/execute for support. **Gaps called out:** no subscription row still allows record creation by design; API monthly limits are partly display-only; QuickBooks/portal/inventory are permission-first. Billing **Usage** card notes seats/equipment enforcement vs API counter honesty. Recommended follow-ups: **60.2** metering, **60.3** seats, **60.4** grace/lockout UX, **60.5** AI/automation governance.
- **Phase 60.2 — Usage metering & enforcement:** New \`docs/USAGE_METERING_ENFORCEMENT.md\` (matrix: seats, equipment, AI MTD/budget, API rollup table, automations, etc.). **API calls:** \`organization_api_usage_monthly\` still has **no app writers** — billing bar remains informational/zero until increment points ship. **Hardening:** member \`requireCanCreateRecord\` / \`requireWithinPlanLimit\` use **strict** usage-count verify — if \`getUsageWithLimits\` fails and the org has a subscription row with a **finite** seat/equipment cap, block with **503** (\`usage_unavailable\`) instead of fail-open; **cron/service** path stays fail-open; **platform admins** bypass strict verify (profile email). Helper \`isMonthlyApiCallPlanCapExceeded\` for future guards. Billing Usage footnote distinguishes enforced vs tracked.
- **Phase 60.3 — Seat limit enforcement:** **Reserved seats** = billable active + invited \`organization_members\` + pending unexpired \`organization_invites\`; **platform-admin allowlist emails** excluded from billable counts (\`lib/billing/seat-counts.ts\`). \`GET /api/organizations/[organizationId]/seat-metrics\` powers billing + team + \`BillingAccessProvider\` seat slots. **Invites:** \`/api/invites/create\` now runs \`checkOrgInviteEligibility\` and **deletes** the invite row if email send fails; \`invite-member\` rechecks billing before insert. **Platform-admin inviter** skips numeric seat cap (\`skipSeatCap\`). Token **accept** path unchanged (reserved swap pending→active). Docs: \`docs/USAGE_METERING_ENFORCEMENT.md\` seat policy section.
- **Phase 60.4 — Grace period / lockout UX:** Honest subscription messaging without **hard lockout** (read access unchanged). \`lib/billing/access.ts\` — refined \`getBillingWarningMessage\` copy (no “locked” / “restore access” framing); new \`getBillingAppBannerTone\` + \`MISSING_SUBSCRIPTION_BILLING_NOTE\`. \`components/billing-warning-banner.tsx\` uses shared tone + trial window constant. **Billing page:** “Payment needs attention” card, past due wording, **Billing setup** info when no \`organization_subscriptions\` row (CTA to plan comparison for editors); stats label **Seats reserved**. Docs: \`docs/BILLING_ACCESS_AND_GRACE_PERIODS.md\`. Platform admins see the same strips inside customer orgs (informational only).
- **Phase 60.5 — AI & automation governance:** \`docs/AI_AUTOMATION_GOVERNANCE.md\` — route matrix (AI Ops, AIden, workflows, communications). **Cron** \`/api/cron/ai-ops-digest\`: per-org \`requireFeatureAccess(..., "ai")\` before send; \`skipped_no_ai_entitlement\` + \`logAiGovernanceSkip\` (\`lib/ai/governance-log.ts\`). **API:** narrate (pre-LLM), communications AI assist, prospect draft-followup, follow-up regenerate-draft, digest settings PATCH when enabling — \`ai\` gate for non–platform-admin; digest **send/preview/test-destination** add **PA bypass**. Entitlement audit doc updated.
- **Phase 61.1 — QuickBooks production hardening:** \`docs/QUICKBOOKS_PRODUCTION_READINESS.md\` — env vars, redirect URI, scopes, manual QA. **Security:** integration GET strips \`realm_id\` from JSON (\`quickbooks_company_linked\` only). **Connection:** \`error\` status distinct from disconnected (\`getQuickBooksConnection\` \`connection_error\`). **Logging:** \`lib/integrations/quickbooks/safe-log.ts\` — \`sanitizeQuickBooksClientMessage\`, structured \`quickbooks_integration\` stdout; sync-runner sanitizes row errors. **UI:** Settings + hub show **Needs attention**; invoice drawer \`connectionNeedsAttention\`; API environment pill (\`getQuickBooksApiEnvironment\`). **.env.example** documents \`QUICKBOOKS_API_BASE_URL\` sandbox note.
- **Phase 61.2 — Webhook & public API expansion (architecture):** \`docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md\` — recommended key model (hash-at-rest, org scope, RLS, rate limits, audit), outbound webhook shape (signing, retries, delivery log), plan \`api_access\` + \`canManageApiKeys\`, platform-admin behavior; **no** live keys, public REST router, or webhook worker. **UI:** \`/settings/api\` remains non-interactive with roadmap + links to architecture, metering, entitlement, settings-audit docs. **Scaffolding:** \`lib/api/future-webhook-event-types.ts\` (unused event constants). **Docs:** \`SETTINGS_WIRING_AUDIT.md\`, \`USAGE_METERING_ENFORCEMENT.md\`, \`PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md\` cross-links.
- **Phase 61.3 — Integration catalog accuracy audit:** \`docs/INTEGRATION_CATALOG_INVENTORY.md\` + \`lib/integrations/catalog-metadata.ts\` — shared readiness badges (**Live, Beta, Limited, Planned, Coming Soon, Internal, Enterprise** types; UI uses existing \`ds-badge-*\`). **Product** \`/integrations\`: QuickBooks **Live** (link to Settings), Stripe billing **Limited**, Fuzor **Beta** external link (**Visit Fuzor**, not “Connect”), roadmap **Planned** + **Register interest**; removed fake KPI “Automation Ready: 12”; interest/request modals disclose **no server submit**. **Settings** hub: readiness pills from catalog map; **No in-app setup yet** replaces fake Connect/Docs stubs; QuickBooks live \`connection_status\` pill unchanged. **Entitlements:** marketing banner distinguishes future **API keys** (Scale) from connectors. No DB migrations.

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

### Attachments (drawer UX)
- **Phase 56.7:** Shared file presentation uses \`lib/attachments/attachment-media-kind.ts\` (MIME + extension classification, friendly labels) and \`components/attachments/attachment-preview.tsx\` (thumbnail for images with safe fallback, type icon tile). Primary surfaces: \`DocumentAttachmentsPanel\`, work order attachment lists, certificate attachment card, catalog item files tab.

### Equipment
- **Routes:** \`/equipment\`, \`/equipment/[id]\`
- **Purpose:** Asset registry, categories, warranty fields, and device-level history timeline.
- **Status:** Implemented.
- **Key UI:** Equipment detail History tab aggregates service, calibration, billing, document, warranty, notes, and maintenance activity.
- **Tables:** \`equipment\` (+ migrations for warranty/metadata), plus linked \`work_orders\`, \`work_order_equipment\`, \`calibration_records\`, \`certificate_attachments\`, \`org_document_attachments\`, \`invoice_work_order_links\`, \`org_invoices\`, and \`maintenance_plans\`.
- **Gaps:** Deeper equipment-type reporting and portal-facing equipment history.

### Work Orders
- **Routes:** \`/work-orders\`, \`/work-orders/[id]\`
- **Purpose:** Full WO lifecycle — quick mobile appointment creation, scheduling, assignment, labor/parts, attachments, signatures, certificates linkage.
- **Status:** Implemented (large surface area).
- **Key UI:** \`work-order-detail-experience\`, drawers, certificate tabs.
- **Tables:** \`work_orders\` (+ many additive columns; \`equipment_id\` can be null for service visits), related tasks/parts/attachments migrations.
- **Gaps:** Service-to-invoice linkage polish, deeper mobile field UX.

### Service Schedule
- **Route:** \`/service-schedule\`
- **Purpose:** Calendar-oriented upcoming maintenance / service view with unassigned lane, drag/drop scheduling, and quick appointment creation.
- **Status:** Implemented.
- **Gaps:** Advanced route optimization and notification polish.

### Maintenance Plans
- **Routes:** \`/maintenance-plans\`, related dialogs.
- **Purpose:** Recurring PM; automated WO creation when due.
- **Status:** Implemented; cron drives due processing (\`/api/cron/maintenance-due\`).
- **Tables:** maintenance plan tables + automation engine migrations.
- **Gaps:** Complex recurrence edge cases; notification tuning.

### Technicians
- **Routes:** \`/technicians\`, \`/technicians/today\`, \`/technicians/daily\`
- **Purpose:** Roster, organization-managed skill tags, certifications, focused technician workspace, field UX, and stored technician signatures.
- **Status:** Implemented (operational technician table + UI; skill tag options managed in Settings → Team; stored signatures can be uploaded/drawn/replaced). Technician profile users get a restricted dashboard/nav, assigned-work order and schedule views, and reduced billing/admin controls.
- **Gaps:** Server-side RLS can be tightened further for assigned-only reads if the org wants hard DB-level technician isolation beyond application capability gates.

### Certificates (calibration)
- **Routes:** \`/calibration-templates\` (nav label “Certificates”), WO certificate tabs.
- **Phase 56.8:** Certificates page defaults to the **Completed Certificates** tab; **Templates** is next in the tab row. Deep link with \`?tab=templates\` or \`?tab=completed\` (default when omitted: completed). Work order **Manage templates** links use \`?tab=templates\`.
- **Purpose:** Templates (\`calibration_templates\`), per-WO records (\`calibration_records\`), generated PDF/HTML output, external certificate PDF uploads, technician signature application, and portal release policy.
- **Status:** MVP complete; portal exposes certificates API and released certificate attachments.
- **Key UI:** Work order certificate tabs support template-based generation plus external certificate uploads with labels, issue/expiry dates, portal visibility, equipment, calibration record, invoice metadata, release/revoke controls, signature status, and withheld reasons.
- **Tables:** \`calibration_templates\`, \`calibration_records\`, \`certificate_attachments\`, and unified \`org_document_attachments\` release metadata.
- **Gaps:** Optional last-used-on-certificate analytics for technician signatures.

### Quotes
- **Route:** \`/quotes\`
- **Purpose:** Quote authoring and customer approval flows (incl. portal).
- **Tables:** \`org_quotes\` family.
- **Gaps:** Terms-driven due dates; tax logic.

### Invoices
- **Route:** \`/invoices\`
- **Purpose:** Invoicing, send email routes, QuickBooks export when connected, and invoice-linked document/certificate visibility.
- **Tables:** \`org_invoices\` family.
- **Customer-facing display (Phase 56.4):** Staff invoice preview uses stored subtotal (\`amount_cents\`), tax only when \`tax_amount_cents\` is non-zero, grand total from \`amount_cents + tax_amount_cents\`, and payment rows from \`org_invoice_payments\` when hydrated. Portal invoice detail (\`/api/portal/invoices/[id]\`) returns sanitized line items plus billing snapshot fields from the invoice row. Invoice customer emails use the same grand total and optional subtotal/tax lines (no recalculated tax).
- **Gaps:** Payment allocation vs QB; automatic due dates; jurisdiction tax.

### Purchase Orders & Vendors
- **Routes:** \`/purchase-orders\`, \`/vendors\`
- **Status:** Implemented.
- **Tables:** \`org_purchase_orders\`, \`org_vendors\`.

### Inventory
- **Route:** \`/inventory\`
- **Purpose:** Stock by location; receive, transfer, adjust, consume on work orders; low stock / reorder center; technician van bins.
- **Status:** Implemented (many \`/api/organizations/.../inventory/*\` routes).
- **UX map (Phase 58.1):** Add/edit **parts** in \`/catalog\` (drawer: **Archive item** with confirm — archival, not delete; **Manage stock quantities** links to Inventory with \`itemId\`). **Receive stock** / **Adjust stock** on Adjust/receive tab. **Transfer stock** on its tab (and technician “return” uses the same transfer API). **Consume part** under Consume parts & history. **Reorder alerts** on Overview; **Reorder** tab for restock workflows and draft PO suggestions. Van locations: **Add location** (toolbar) + **Van & truck stock** assignments.
- **Gaps:** Deeper procurement automation; barcode scanning (out of scope for 58.1).

### Catalog & imports
- **Routes:** \`/catalog\`, \`/catalog/import\`; APIs for \`catalog_items\`, \`price_list_imports\`, AI extraction jobs.
- **Status:** Implemented with AI-assisted import pipeline.
- **Gaps:** Verification UX at scale.

### Reports
- **Route:** \`/reports\`
- **Purpose:** Analytics exports / reporting UI, including equipment-type/category performance.
- **Status:** Implemented with org analytics API support.
- **Key UI:** Equipment type report rows show equipment counts, work/order volume, linked revenue, calibration volume, open issues, next-due counts, and top customers by type.
- **Gaps:** Future SQL/materialized reporting views for very large tenants.

### Insights & AI Assistants
- **Routes:** \`/insights\`, \`/ai-assistants\`; in-app AIden help chat via \`/api/organizations/[organizationId]/aiden/chat\`.
- **Purpose:** AI insights generation; operational assistants; job queue processing; AIden provides step-by-step in-app product help grounded in this master context.
- **Status:** Implemented; cron processes AI jobs; AIden is lightweight, session-only chat in the dashboard shell.
- **Layout note (Phase 56.6):** The AIden launcher owns the bottom-right (\`z-[95]\`). Fixed drawer toasts, billing trial chip, and similar stacks use \`.br-stack-clear-aiden\` + \`--aiden-launcher-*\` CSS vars (\`app/globals.css\`) so they sit above the launcher; Radix \`ToastViewport\` uses the same offset on \`sm+\`.
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
- **Purpose:** Honest integration catalog + real QuickBooks admin surface.
- **Status:** QuickBooks connection + sync implemented; marketing catalog aligned with inventory (Phase 61.3).
- **Gaps:** Build additional OAuth connectors (Gmail, Calendar, etc.) per roadmap; public API keys when architecture ships.

### Customer portal
- **Routes:** \`/portal/*\` (login, dashboard, equipment, work orders, invoices, quotes, certificates, maintenance, etc.)
- **Purpose:** Customer self-service via magic-link / portal session, including secure documents and customer-safe service visit visibility.
- **Status:** Core flows implemented; APIs under \`/api/portal/*\`; document library aggregates released invoices, quotes, certificates, service summaries, and uploaded files with search/filter UI; service visits show upcoming appointments and recent completed work without exposing dispatch internals or customer self-scheduling.
- **Staff preview:** \`/portal/preview\` (after \`/api/portal/preview/start\`) — read-only snapshot for **owner/admin** (\`canManagePortalSettings\`); uses same dashboard/document bundle helpers as portal data paths; applies workspace logo + \`primary_color\` as portal CSS variables; does **not** set the portal session cookie. See \`docs/PORTAL_PREVIEW_CONTEXT.md\`.
- **Gaps:** Portal reports page still mock/demo in places; document library could later add generated PDF downloads for invoice/quote detail pages.

### Platform admin
- **Routes:** \`/admin\`, \`/admin/ai-operations\`, \`/admin/master-context\`
- **Purpose:** Cross-tenant operations (accounts, AI ops, internal context doc).
- **Status:** Implemented (platform APIs under \`/api/platform/*\`).

## Current Workflow Map
1. **Customer** record → **locations** & **contacts**.
2. **Equipment** installed at customer/location context.
3. **Work order** created (ad hoc, quick appointment, or from **maintenance plan** / schedule).
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
- **Signatures:** Customer signature capture exists on WO flows; generated certificates prefer fresh technician visit signatures, fall back to stored technician profile signatures, then show an explicit fallback/unsigned state.
- **Gaps:** Attachment storage policy hardening and deeper signature usage analytics.

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
- **Commercial profiles:** Optional \`organization_members.permission_profile\` overlays support Owner, Admin, Operations Manager, Technician, Billing, Sales / Prospects, and Viewer without replacing the DB role enum. \`permissions_json\` stores optional boolean capability overrides for application/API guards.
- **Server enforcement:** RLS remains the tenant boundary; APIs use \`requireOrgPermission\` / \`getEffectiveOrgPermissions\` for capability checks. Sensitive areas such as certificate release, reports, attachment mutation, billing/settings, imports, and team management should gate mutations through capabilities.
- **Technician access:** Technician profile defaults include \`canUseTechnicianWorkspace\` and \`canViewAssignedWorkOrdersOnly\`; the dashboard, sidebar/mobile nav, work-order list, and schedule views prioritize assigned field work and hide financial/admin/dispatch controls unless additional capabilities are granted.
- **UI:** Team settings show DB role, optional permission profile, and an access preview; Settings → Permissions is generated from the shared capability map. Demo **TenantProvider** \`can()\` helpers can still diverge from live membership — treat **server checks + RLS** as source of truth.

## UI/UX Standards
- **Inline empty & errors (dropdowns, table footers, compact panels):** Use a muted or semantic icon, one-line title, and short helper text. When a request can be retried, pair the message with an outline **Retry** button (\`Button\` \`variant="outline"\` \`size="sm"\`). Avoid raw API strings as the only copy — add context or a next step where feasible.
- **Brand:** Primary blue (\`--primary\`, \`--status-info\` ~ **#0f7ae5**); **CTA orange** \`--cta\` **#f59f1c** for primary filled actions; **AI accent** aligns with brand blue (\`--ai-purple\`).
- **Dark chrome:** Admin header uses **#0F172A**; app sidebar dark navy per \`globals.css\` (\`--sidebar\` / **#08111f** tones).
- **Components:** Prefer \`components/ui\` patterns; tables + cards for dense data; **drawers/sheets** for create/edit flows.
- **Mobile:** Bottom nav and technician-oriented compact layouts on select routes.
- **Data display:** Avoid showing raw UUIDs in primary UI — prefer human labels, numbers, slugs.
- **Icons:** Sidebar modules use consistent lucide icons / module icon helpers.
- **Accessibility:** Semantic headings, focus rings (\`--ring\`), sufficient contrast; prefer Radix primitives from \`components/ui\`.

## Known Limitations / Technical Debt
- Demo/mock layers (\`tenant-store\`, some portal pages) can drift from production RBAC.
- Settings surfaces: personal notification channels and static reminder cadence cards are **not** persisted until dedicated APIs exist — see \`docs/SETTINGS_WIRING_AUDIT.md\`.
- Capability enforcement: some routes (e.g. parts of Communications / AI-Ops) still use raw \`organization_members.role\` branching; Settings nav intentionally uses role-default permissions — see \`docs/PERMISSIONS_ENFORCEMENT_AUDIT.md\`.
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
Use this context to create implementation prompts that preserve existing architecture, avoid duplicate systems, follow current UI patterns, and sequence work in safe phases. Never ask GPT to embed secrets; prefer referencing env var **names** only. After meaningful commits, run \`pnpm update:master-context\` so inventory sections stay accurate.

---

*Manual sections live in \`lib/admin/master-context.ts\`; repository inventory is generated into \`lib/admin/master-context.generated.ts\`.*
`
}
