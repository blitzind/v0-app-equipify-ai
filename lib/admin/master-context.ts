/**
 * Equipify Master Context Doc — narrative sections are maintained here.
 * Repository inventory is injected from `master-context.generated.ts` (see `pnpm update:master-context`).
 * TODO: Optionally automate deeper schema/route introspection; keep secrets out of this file.
 */
import { MCG_SCAN_SECTION } from "./master-context.generated"

/** Updated by `scripts/update-master-context.ts` alongside generated scan output. */
export const MASTER_CONTEXT_LAST_UPDATED_ISO = "2026-05-11T23:22:17.740Z"

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
- **Repo validation:** \`pnpm check:tracked-imports\` scans tracked files under \`app/\`, \`components/\`, \`lib/\`, \`hooks/\`, and \`actions/\` for local imports (\`@/\` or relative) that resolve to files on disk but are **not** in the git index — a common cause of Vercel-only "module not found" when a module was never committed. The same check runs automatically as \`prebuild\` before \`pnpm build\`. Implementation: \`scripts/check-tracked-imports.ts\`.
- **Integrations (product):** QuickBooks Online OAuth + export sync (customers, catalog items, invoices) + optional invoice auto-sync; Stripe **billing** lives under Settings → Billing (not a generic tenant “Stripe Connect”); marketing **Integrations** catalog uses **Live / Limited / Beta / Planned** labels from \`lib/integrations/catalog-metadata.ts\` — see \`docs/INTEGRATION_CATALOG_INVENTORY.md\`; **no Gmail OAuth** in app code today (\`docs/GMAIL_INTEGRATION.md\`).

## App Architecture
- **Route groups:** \`app/(dashboard)\` staff UI; \`app/(portal)\` customer portal; \`app/(admin)\` platform admin (\`/admin/*\`), gated by platform-admin identity server-side.
- **Layouts:** Dashboard uses main product shell (sidebar, top bar); portal uses portal shell; admin uses \`AdminWorkspaceShell\` + dark admin headers on individual pages.
- **Middleware:** Session refresh; dashboard path prefixes protected; \`/portal/*\` uses portal cookie gate (except login); \`/admin\` loads only for platform admins (layout redirect).
- **Tenant handling:** Active organization from membership (\`organization_members\`) + profile default org; almost all domain rows are scoped by \`organization_id\`.
- **Phase 57.1 — Header search:** Desktop top bar uses \`GlobalSearchHeader\` → \`GET /api/organizations/{organizationId}/global-search?q=\` with \`requireOrgMemberSession\` and \`runOrgGlobalSearch\` (\`lib/global-search/run-global-search.ts\`). Results are grouped (customers, equipment, work orders; invoices if \`canViewFinancials\`; quotes if \`canViewQuotes\`; maintenance plans if \`canManageDispatch\`; roster profiles if technician permissions). Technician assigned-only scope uses \`loadAssignedWorkScope\` for customers/equipment/work orders. Mobile header has no search field (avoid non-functional stub).
- **Phase 57.2 — Settings wiring honesty:** See \`docs/SETTINGS_WIRING_AUDIT.md\` for the full matrix. High-signal changes: \`/settings/security\` and \`/settings/api\` no longer show interactive demo MFA, sessions, or fake API keys; \`/settings/general\` drops a non-functional password form; \`/settings/notifications\` personal channel matrix and digest/quiet shells are read-only previews; \`/settings/automations\` “Reminder emails” cadence cards are preview-only (persisted automation is Follow-up + Workflow sections). Workspace “Contact support” links out instead of a disabled stub.
- **Phase 57.3 — Permission enforcement alignment:** See \`docs/PERMISSIONS_ENFORCEMENT_AUDIT.md\`. Server gates now use \`getOrganizationMemberRecord\` + effective capabilities for **staff portal preview**; **portal invites** require \`canManagePortalSettings\` (not a loose manager role list); **workspace PATCH** uses \`canManageWorkspaceSettings\` (fixes manager vs owner/admin-only raw check); **default invoice terms** GET/PATCH use financial/billing capabilities. Route Handler gates use \`lib/api/require-org-permission.ts\` (\`requireOrgPermission\` / \`requireAnyOrgPermission\` / \`requireOrgMemberSession\`); the unused legacy \`requireOrgMemberPermission\` module was **removed in Phase 62.1** (it had no call sites).
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
- **Phase 62.1 — Dead code & duplicate pattern cleanup:** Removed unused \`lib/permissions/require-org-permission.ts\` (\`requireOrgMemberPermission\` had zero imports). Centralized invoice status badge Tailwind strings in \`lib/invoices/invoice-status-badge-classes.ts\` for drawer header, invoice detail badge, and invoices list (Void row still adds \`line-through\` locally). Product \`/integrations\` roadmap KPI counts **planned** rows only (removed redundant always-zero \`coming_soon\` sum). No permission/entitlement/offline/sync logic changes; \`lib/integrations/catalog-metadata.ts\` remains the integration catalog source.
- **Phase 62.2 — Performance & query optimization:** See \`docs/PERFORMANCE_AND_QUERY_OPTIMIZATION_AUDIT.md\`. **Dashboard hook** (\`lib/dashboard/use-supabase-dashboard.ts\`): head-only counts use minimal \`select('id', …)\`; overdue invoice rows filtered server-side with the same rule set as before (past due date **or** overdue with null due date); **Insights** uses \`variant: 'insights'\` to skip recent-work-order + preview-list queries not shown on that page. No RLS bypass; QuickBooks/offline/sync paths untouched.
- **Phase 62.3 — Accessibility & responsive validation:** See \`docs/ACCESSIBILITY_AND_RESPONSIVE_VALIDATION.md\`. **Page shell:** skip link + \`main\` landmark \`id="main-content"\`; **mobile:** hamburger ↔ \`mobile-sidebar-nav\` wiring (\`aria-expanded\`, \`aria-controls\`), navigation landmark on drawer, wider close target; **Quick Add / More** sheets: dialog semantics, \`h2\` titles, Escape to close, \`max-h-[85dvh]\` scroll; **toasts:** provider region label; **offline WO sync bar:** \`aria-live="polite"\`. No permission/entitlement/offline logic changes.
- **Phase 62.4 — Error boundary & failure-state standardization:** See \`docs/ERROR_BOUNDARY_AND_FAILURE_STATE_STANDARDS.md\`. **Canonical copy:** \`lib/failure-states/copy.ts\` (\`FAILURE_COPY\`). **Shared UI:** \`RouteErrorFallback\` (\`components/failure-states/route-error-fallback.tsx\`) for Next.js \`error.tsx\` / \`global-error.tsx\`; \`SectionFailureState\` for inline drawer/section failures with optional real retry. **Routes:** \`app/error.tsx\`, \`app/global-error.tsx\`, \`app/not-found.tsx\`, plus segment \`error.tsx\` for \`(dashboard)\`, \`(portal)\`, \`(admin)\`. **Hardening example:** \`FeedDetailDrawer\` detail fetch uses standardized copy + retry nonce (no raw API message). **Small copy drift:** provisioning default message (\`lib/onboarding/error-mapping.ts\`), AI job unknown-error fallback (\`sanitizeAiJobError\`). No API contract changes; permission/entitlement/RLS/offline/QB behavior unchanged.
- **Phase 63.1 — Advanced reporting export center:** See \`docs/ADVANCED_REPORTING_EXPORT_CENTER.md\`. **Shared CSV:** \`lib/reporting/export-csv.ts\` (UTF-8 BOM default for Excel), \`equipifyExportFilename\`, \`CLIENT_CSV_EXPORT_ROW_WARN_THRESHOLD\`. **UI:** \`ReportExportCenter\` on \`/reports\`; operational + financial CSV buttons use consistent filenames, BOM, busy state, and toasts; **communications feed** export deduped to shared helpers; **audit log** preview CSV wired with honest labeling; **portal reports** mock downloads replaced with Sonner honesty toast. **Permissions:** unchanged API gates (\`reports/analytics\`, \`reports/financial-invoices\`). **Invoice cap:** 8000-row server limit unchanged (\`financial-invoices-report\`). No new entitlement wiring for \`reports_advanced\` in this phase.
- **Phase 63.2 — Executive dashboard expansion:** See \`docs/EXECUTIVE_DASHBOARD_EXPANSION.md\`. **Hook:** \`lib/dashboard/use-supabase-dashboard.ts\` — added bounded head counts (completed this month via \`completed_at\`; quote pipeline draft/sent/pending; unassigned open WOs; active PM plans) inside existing parallel batch; extended \`buildOperationalInsights\` for unassigned + quotes. **UI:** \`app/(dashboard)/page.tsx\` — Executive snapshot heading + stat cards; quote pipeline card only when \`canViewQuotes\`. **KPIs:** revenue / overdue invoice tiles unchanged; completion metric documented as distinct from revenue timing. No new APIs; RLS unchanged; Phase 62.2 parallel-load pattern preserved.
- **Phase 63.3 — KPI & analytics standardization:** See \`docs/KPI_AND_ANALYTICS_STANDARDIZATION.md\`. **Module:** \`lib/kpi/definitions.ts\` — canonical DB status sets (open WO pipeline, revenue rollup, completed-at month, quote pipeline, invoice aging fetch, reports analytics completion set, repeat-repair / warranty day constants). **Wired into:** \`use-supabase-dashboard\`, \`computeReportAnalytics\` (\`lib/reporting/compute-analytics.ts\`), \`rollup-metrics\` (quotes + open WO), \`internal-notifications/evaluate\` (open WO). **Documented** intentional difference: monthly revenue (labor/parts, \`updated_at\` on \`completed\`/\`invoiced\`) vs. completed-this-month (\`completed_at\`, includes pending signature). No export column changes; no entitlement weakening.
- **Phase 63.4 — Production UX copy & onboarding fixes:** **Catalog / billing gates:** \`requireOrgMemberRead\` and billing checkout used \`organization_members\` \`select('id')\` but the table is composite-keyed — fixed to \`organization_id\` existence checks (restores catalog list + signup-adjacent reads without weakening membership checks). **Communications feed enrichment:** \`lib/communications/feed.ts\` now resolves invoice/quote labels against \`org_invoices\` / \`org_quotes\` (and \`customers.company_name\`) so entity labels work instead of invalid relation names. **Settings copy pass:** customer-facing Settings strings (General password card, Security, Permissions, Portal login/session + module note, Integrations, API roadmap shell, Billing usage footnote, AI Usage cache explainer, Workspace diagnostics) avoid leaking repo paths, vendor stack jargon, and internal implementation terms where inappropriate; optional certificate/terms/consolidated option blurbs use a neutral \`detail\` field name. No permission or entitlement weakening.
- **Phase 63.5 — Billing invoice defaults control:** \`/settings/payments\` passes \`orgPermissions.has("canEditOrgBilling")\` into \`WorkspaceInvoiceDefaultsCard\` (formerly on Billing). Earlier, \`useOrgPermissions()\` only exposed capabilities via \`.has(key)\` / \`.permissions\` — a mistaken top-level flag left the payment-terms \`<select>\` disabled. **UX:** save button idle label is "No changes to save" instead of a misleading always-on "Saved".
- **Phase 63.6 — AI usage limits & overage copy:** Scale marketing no longer claims **unlimited** AI (\`lib/plans.ts\`); Settings → **AI usage** clarifies optional **workspace** caps vs plan **included** allowance (\`PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD\`), replaces "Warn, allow overage" framing with billing-safe language (no implied free unlimited usage; self-serve does not auto-add overage charges; custom contracts follow the agreement), and tightens banners/toasts/placeholders. No enforcement logic or entitlement changes.
- **Phase 63.7 — Industry sample data expansion:** First-signup and **Settings → Sample data** import share \`seedDemoForIndustry\` / \`executeDemoSeed\`. All industries now seed scaled **vendors, catalog, quotes, invoices, purchase orders, prospects, inventory locations + on-hand stock, communication_events**, and **AI Ops** lifecycle/events (keys prefixed \`demo_seed_\` for safe reset). **Technician skill tags** from the industry profile use \`is_sample\` (\`20260812200001_technician_skill_tags_is_sample.sql\`). Targets live in \`lib/demo-seeding/industry-sample-packs.ts\`; biomedical keeps a richer bundle. Reset deletes \`EQ-DEMO-LOC%\` demo warehouses in addition to legacy \`PBS-SEED%\`. Doc: \`docs/SAMPLE_DATA_AND_FIRST_SIGNUP_SEEDING.md\`.
- **Phase 63.8 — First-run experience & launchpad:** **Dashboard** \`DashboardLaunchpad\` reads \`GET /api/organizations/{organizationId}/first-run\` (membership gate only) for head-count completion against **non-sample** rows (invoices: non-draft). **Welcome modal** (\`FirstRunWelcomeGate\`) shows once per user per org when sample content is present and \`equipify_welcome_ack_org_ids\` (Auth \`user_metadata\`) does not include the org. **Dismiss / restore launchpad** uses \`equipify_launchpad_hidden_org_ids\`; **PATCH** \`/first-run\` merges via service-role \`auth.admin.updateUserById\` (self-only). **Industry copy** from \`lib/first-run/launchpad-copy.ts\`; **step applicability** from \`lib/first-run/launchpad-eligibility.ts\` (no fake completion). **Settings → Sample data** clarifies modules, reset safety, idempotent re-import, and “Show checklist on dashboard” for owners/admins (+ platform admins). Doc: \`docs/FIRST_RUN_EXPERIENCE_AND_LAUNCHPAD.md\`.
- **Phase 63.9 — Sample data removal UX:** **Settings → Sample data** destructive flow uses the confirmation phrase **REMOVE SAMPLE DATA** (\`lib/demo-data/remove-sample-confirmation.ts\`, shared with \`POST /api/demo-data/reset\`), **Remove sample data** button labeling, controlled \`AlertDialog\` close (block cancel/escape while the POST runs), and a success toast fed by \`resetSampleDataForOrganization\` summary counts.
- **Phase 64.1 — BlitzPay Connect onboarding (Phase 1):** **Stripe Connect Express** (US, \`card_payments\` + \`transfers\` requested) stored on \`organizations\` (\`stripe_connect_account_id\`, status + requirements jsonb, \`last_stripe_connect_sync_at\`). APIs: \`GET/POST /api/organizations/{id}/blitzpay/{status,enable,sync,account-link}\` (owner/admin + platform admin for writes). **Webhook:** \`POST /api/blitzpay/webhook\` + \`blitzpay_stripe_webhook_events\` + \`STRIPE_BLITZPAY_WEBHOOK_SECRET\`; handles \`account.updated\` only. **UI:** Settings → **Payments** (\`/settings/payments\`). SaaS \`/api/stripe/webhook\` unchanged. Doc: \`docs/BLITZPAY_PHASE_1.md\`.
- **Phase 64.2 — BlitzPay Phase 2A (payment foundation):** Migrations add \`blitzpay_org_settings\`, \`blitzpay_payment_intents\`, \`blitzpay_invoice_payment_attempts\`, \`blitzpay_fee_snapshots\`, \`blitzpay_ledger_entries\`, \`blitzpay_webhook_inbox\` (RLS: org members **read** payment tables; inbox service-role only). **Webhook** same endpoint routes \`payment_intent.*\`, \`checkout.session.completed\`, and (inbox + mirror) Connect lifecycle events — **Phase 2B** adds allocation; **Phase 2E** completes refund/dispute handlers (see §64.5). **Libs:** \`lib/blitzpay/payment-repository.ts\`, \`fees.ts\`, \`stripe-metadata.ts\`, \`idempotency-keys.ts\`, etc. **Env:** \`BLITZPAY_INVOICE_PAY_ENABLED\` (global gate, default off). Doc: \`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md\` §12.
- **Phase 64.3 — BlitzPay Phase 2B–2C hosted invoice pay:** Shared \`prepareBlitzpayInvoiceHostedCheckout\` (\`lib/blitzpay/blitzpay-prepare-invoice-pay.ts\`) powers **staff** \`POST /api/organizations/{org}/invoices/{id}/blitzpay/prepare-pay\` (metadata \`payment_source=staff_dashboard\`, attempt channel \`checkout\`) and **customer portal** \`POST /api/portal/invoices/{id}/blitzpay/prepare-pay\` (\`requirePortalSession\`, invoice must match portal customer; \`payment_source=customer_portal\`, channel \`portal_link\`, return URLs under \`/portal/invoices/...\`). Stripe Checkout on the **connected account** with \`application_fee_amount\`; webhook completion idempotently writes \`org_invoice_payments\` + ledger (Phase 2B). Portal invoice UI + bootstrap \`features.onlinePayments\`. Doc: \`docs/BLITZPAY_PHASE_2_ARCHITECTURE.md\` §12.2–12.3.
- **Phase 64.4 — BlitzPay Phase 2D (payment UX):** Portal **Payment update** + poll after Checkout success; **Payment history** on \`GET /api/portal/invoices/{id}\` (customer-safe rows via \`lib/portal/portal-invoice-payment-history.ts\`). Staff \`GET .../blitzpay/activity\` + Payments tab **BlitzPay online attempts** (\`lib/blitzpay/staff-blitzpay-invoice-activity.ts\`). Receipt-shaped helper \`lib/blitzpay/invoice-payment-receipt.ts\` (email in §64.6). Doc §12.4; test \`pnpm test:blitzpay-phase-2d\`.
- **Phase 64.5 — BlitzPay Phase 2E (refunds, disputes, diagnostics):** Migration \`20260913120000_blitzpay_phase_2e_refunds_disputes.sql\` (\`blitzpay_invoice_refunds\`, \`blitzpay_invoice_disputes\`). Staff \`POST /api/organizations/{org}/invoices/{id}/blitzpay/refund\` + \`GET .../blitzpay/diagnostics\`; \`GET .../blitzpay/activity\` now includes refunds + disputes. Webhook: \`charge.refunded\`, \`charge.dispute.created\` / \`updated\` / \`closed\`. Net balances: \`reconcileOrgInvoiceFromPayments\` + invoice hydration subtract succeeded BlitzPay refunds; portal \`GET .../invoices/{id}\` adds customer-safe refund lines (no dispute payloads). Helpers: \`lib/blitzpay/blitzpay-refund-apply.ts\`, \`staff-blitzpay-invoice-support.ts\`, \`blitzpay-reporting-snapshot.ts\`. Doc §12.5; test \`pnpm test:blitzpay-phase-2e\`.
- **Phase 64.6 — BlitzPay Phase 2F (receipt email + staff alerts):** Migrations \`20260913150000_blitzpay_phase_2f_receipt_dispatches.sql\` + \`20260913151000_blitzpay_receipt_dispatch_skipped_preference.sql\` — \`blitzpay_payment_receipt_dispatches\` idempotency for webhook auto customer + staff sends. \`completeBlitzpayPaymentIntentSucceeded\` triggers \`dispatchBlitzpayPaymentReceiptEmails\` (non-blocking). Customer-safe view model + templates; \`invoice_delivery_preference\` can skip automatic customer mail; staff \`POST .../blitzpay/resend-receipt\` + Payments tab **Resend** when outbound mail is configured. Doc §12.6; test \`pnpm test:blitzpay-phase-2f\`.
- **Phase 64.7 — BlitzPay schema health guard:** \`lib/blitzpay/blitzpay-schema-health.ts\` probes critical BlitzPay tables + org onboarding diagnostic columns (service role, ~60s cache). BlitzPay status / enable / sync / account-link / activity / diagnostics / prepare-pay / refund / resend-receipt return **503** \`blitzpay_schema_incomplete\` with stable copy when migrations are missing instead of raw PostgREST errors. Doc §12.7; test \`pnpm test:blitzpay-schema-health\`.
- **Phase 64.8 — BlitzPay Phase 2H (payout ledger):** Migration \`20260915130000_blitzpay_phase_2h_payout_ledger.sql\` — \`blitzpay_payouts\`, \`blitzpay_balance_transactions\`, \`blitzpay_reconciliation_runs\`. \`lib/blitzpay/blitzpay-payout-sync.ts\` upserts payouts + per-payout balance lines (Connect) and links PIs via charge ↔ \`payment_captured\` ledger. Webhooks: \`payout.*\` on Phase 2 path. APIs: \`GET/POST /api/organizations/{id}/blitzpay/payout-ledger\`. Reporting prefers synced Stripe fees/net when balance rows exist. Settings → **Payments** staff payout panel; invoice diagnostics add \`balanceTransactionReconciliation\`. Doc §12.9; test \`pnpm test:blitzpay-phase-2h\`.
- **Phase 64.9 — BlitzPay Phase 2I (multi-method + stored profiles):** Migration \`20260916110000_blitzpay_phase_2i_multi_method_profiles.sql\` adds card/ACH method toggles, ACH timeline + ACH fee toggle, save-payment-method flag, PaymentIntent method metadata columns, and \`blitzpay_customer_payment_profiles\` (org+customer unique, Stripe reference-only). Preview + prepare-pay support method selection and ACH timeline disclosure. Payment success syncs stored profile references and autopay-eligibility foundation flags (no auto-charging yet). Status/reporting expose method mix, ACH settlement counters, and stored profile summary. Doc §12.10; test \`pnpm test:blitzpay-phase-2i\`.
- **Phase 64.10 — BlitzPay Phase 2R (contractor treasury):** Migration \`20260924120000_blitzpay_phase_2r_treasury_balances.sql\` — \`blitzpay_org_balances\`, \`blitzpay_balance_snapshots\`, org settings \`blitzpay_reserve_target_cents\` / \`blitzpay_instant_payout_interest\`. \`lib/blitzpay/blitzpay-contractor-treasury.ts\` derives balances from synced balance transactions + payouts; \`GET /api/organizations/{id}/blitzpay/treasury\` (financials); reporting/status \`payoutVisibility\` treasury fields; platform revenue rollup adds payout health tiles; payout webhook + manual payout sync refresh treasury best-effort. Doc §12.19; test \`pnpm test:blitzpay-phase-2r\`.
- **Phase 64.11 — BlitzPay Phase 2S (vendor AP):** Migration \`20260925120000_blitzpay_phase_2s_vendor_payables.sql\` — \`blitzpay_vendor_payables\`, \`blitzpay_vendor_payouts\` (internal paid marker). Libs: \`blitzpay-ap-math.ts\`, \`blitzpay-payable-lifecycle.ts\`, \`blitzpay-ap-insights.ts\`, \`blitzpay-vendor-payables.ts\`. APIs: \`GET/POST …/blitzpay/vendor-payables\`, \`PATCH …/vendor-payables/{id}\`, \`GET …/blitzpay/ap-dashboard\`. Reporting snapshot + status \`payoutVisibility\` add AP fields; platform rollup adds AP health; work-order BlitzPay summary links payables (field-safe). Settings **Payments** \`BlitzpayApPanel\`. Doc §12.20; test \`pnpm test:blitzpay-phase-2s\`.
- **Phase 64.12 — BlitzPay Phase 2T (financial command center):** Libs \`blitzpay-command-center-math.ts\`, \`blitzpay-owner-scorecards.ts\`, \`blitzpay-command-center-recommendations.ts\`, server \`blitzpay-financial-command-center.ts\`, \`blitzpay-platform-command-center.ts\`. APIs: \`GET …/blitzpay/financial-command-center\`, \`GET /api/platform/blitzpay/command-center-rollup\`. UI: \`BlitzpayFinancialCommandCenterPanel\`, route \`/insights/financial-command-center\`, Settings anchor, sidebar link, BlitzPay Ops platform strip. Doc §12.21; test \`pnpm test:blitzpay-phase-2t\`.
- **Phase 64.13 — BlitzPay Phase 2U (executive business health, deterministic):** Libs \`blitzpay-business-health.ts\` (\`fetchBlitzpayBusinessHealth\`), \`blitzpay-business-health-types.ts\`, \`blitzpay-executive-recommendations.ts\`, \`blitzpay-customer-payment-behavior.ts\`, \`blitzpay-workflow-cash-pipeline.ts\`, \`blitzpay-platform-business-health.ts\`. APIs: \`GET …/blitzpay/business-health\`, \`GET /api/platform/blitzpay/business-health-rollup\` (platform admin). UI: \`BlitzpayExecutiveDashboard\` on Settings → Payments + Insights financial command center; BlitzPay Ops rollup card. **No LLM / no portal exposure**; bounded scans. Doc §12.22; test \`pnpm test:blitzpay-phase-2u\`.
- **Phase 64.14 — BlitzPay Phase 2V (collections copilot + cash acceleration, deterministic):** Libs \`blitzpay-collections-copilot.ts\`, \`blitzpay-collections-priority.ts\`, \`blitzpay-collections-playbooks.ts\`, \`blitzpay-collections-automation-insights.ts\`, \`blitzpay-collections-acceleration-metrics.ts\`, \`blitzpay-collections-copilot-types.ts\`, \`blitzpay-platform-collections-rollup.ts\`. Extends \`blitzpay-reporting-snapshot.ts\` + revenue intelligence \`dashboard\` + business health \`facts\` with acceleration fields. APIs: \`GET …/blitzpay/collections-copilot\`, \`GET /api/platform/blitzpay/collections-rollup\`. UI: \`BlitzpayCollectionsCopilotPanel\`; BlitzPay Ops collections strip. **No LLM / no portal**; bounded reads. Doc §12.23; test \`pnpm test:blitzpay-phase-2v\`.
- **Phase 64.15 — BlitzPay Phase 2W (recurring revenue + renewal hygiene, deterministic):** Libs \`blitzpay-recurring-billing.ts\`, \`blitzpay-recurring-revenue-types.ts\`, \`blitzpay-recurring-collections-bridge.ts\`, \`blitzpay-recurring-autopay-rules.ts\`, \`blitzpay-renewal-forecast.ts\`, \`blitzpay-membership-health.ts\`, \`blitzpay-platform-recurring-revenue-rollup.ts\`. Extends reporting snapshot, revenue intelligence (incl. churn-adjusted forecast bump), business health facts, collections copilot \`recurringCollectionsSignals\`, treasury dashboard \`recurringCashSignals\`, financial command center tiles. APIs: \`GET …/blitzpay/recurring-revenue\`, \`GET /api/platform/blitzpay/recurring-revenue-rollup\`. UI: \`BlitzpayRecurringRevenuePanel\` on Settings → Payments + Insights financial command center; BlitzPay Ops recurring strip. **No LLM / no portal**; bounded reads (maintenance/contracts/schedules/profiles caps). Doc §12.24; test \`pnpm test:blitzpay-phase-2w\`.
- **Phase 64.16 — BlitzPay Phase 2X (native memberships + recurring ops, deterministic):** Migration \`20260926120000_blitzpay_phase_2x_memberships_recurring_revenue.sql\` (memberships, membership invoices link, payment failures queue, events, retention snapshots + RLS). Libs \`blitzpay-memberships.ts\`, \`blitzpay-recurring-billing-engine.ts\`, \`blitzpay-platform-membership-rollup.ts\`, \`portal-memberships.ts\`. Cron \`POST /api/cron/blitzpay-memberships\` (CRON_SECRET). Org APIs: memberships CRUD-ish + pause/resume/cancel/retry-payment + \`membership-insights\` + \`retention-report\`. Platform \`GET /api/platform/blitzpay/membership-rollup\`. Portal \`GET /api/portal/memberships\` + detail. UI: \`/memberships\` dashboard, Financial nav, customer + WO + invoice hints, financial command center membership tiles, BlitzPay Ops membership rollup. Reporting snapshot adds membership MRR/ARR/deferred/churn fields. Idempotency \`blitzpayMembershipInvoiceGenerationKeyV1\`. Doc §12.25; test \`pnpm test:blitzpay-phase-2x\`.
- **Phase 64.17 — BlitzPay Phase 2Y (payroll accruals + commissions + contractor settlements + revenue share, deterministic):** Migration \`20260928120000_blitzpay_phase_2y_payroll_and_payouts.sql\` — \`blitzpay_payroll_runs\`, \`blitzpay_technician_compensation_profiles\`, \`blitzpay_work_order_commissions\`, \`blitzpay_contractor_settlements\` (**not** Phase 2S \`blitzpay_vendor_payouts\`), \`blitzpay_revenue_share_rules\`, \`blitzpay_revenue_share_ledger\`. Libs: \`blitzpay-payroll-engine.ts\` (pure math), \`blitzpay-payroll-accrual.ts\` (\`syncBlitzpayPayrollAccrualForOrgInvoice\` idempotent; webhook + wallet hooks), \`blitzpay-payroll-runs.ts\`, \`blitzpay-platform-payroll-rollup.ts\`. Org APIs: \`GET …/blitzpay/payroll\`, \`GET/POST …/blitzpay/payroll-runs\`, approve/finalize, \`GET …/blitzpay/commissions\`, \`GET …/blitzpay/vendor-payouts\` (contractor settlements). Platform \`GET /api/platform/blitzpay/payroll-rollup\`. UI: \`BlitzpayPayrollDashboard\`, \`BlitzpayCommissionQueue\`, \`BlitzpayVendorPayoutsPanel\`, \`BlitzpayTechnicianPayoutsPanel\`, \`BlitzpayWorkOrderPayrollStrip\` — Settings → Payments + Insights financial command center + WO drawer + technician performance tab. Extends reporting snapshot, revenue intelligence dashboard, business health facts, financial command center tiles, treasury \`payrollTreasurySignals\`. **No ACH payroll / no portal payroll internals / no raw Stripe ids in new UI.** Doc §12.26; test \`pnpm test:blitzpay-phase-2y\`.
- **Phase 64.18 — BlitzPay Phase 2Z (internal cash buckets + reserve rules + runway snapshots, deterministic):** Migration \`20260929120000_blitzpay_phase_2z_cash_accounts.sql\` — \`blitzpay_cash_accounts\`, \`blitzpay_cash_account_allocations\`, \`blitzpay_cash_reserve_rules\`, \`blitzpay_cash_runway_snapshots\` (RLS org read; service-role writes). Libs: \`blitzpay-cash-accounts.ts\` (pure planning math), \`blitzpay-cash-accounts-service.ts\` (bounded reads), \`blitzpay-platform-cash-accounts-rollup.ts\`. Org APIs: \`GET …/blitzpay/cash-accounts\`, \`GET …/blitzpay/cash-runway\`, \`GET/POST …/blitzpay/cash-reserve-rules\`, \`PATCH …/cash-reserve-rules/[ruleId]\`. Treasury \`GET …/blitzpay/treasury\` adds optional \`cashPlanning\`. Platform \`GET /api/platform/blitzpay/cash-accounts-rollup\`. UI: \`BlitzpayCashAccountsPanel\` (Settings → Payments + Insights FCC), extended financial command center / executive / revenue / treasury / BlitzPay Ops. Reporting snapshot adds Phase 2Z cents + runway status + open dispute sum (bounded). **No bank account creation / no money transmission / no custodial stored money — Connect remains movement source of truth.** Doc §12.27; test \`pnpm test:blitzpay-phase-2z\`.

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
- **Data/API:** Reads via Supabase client + org scope (\`useSupabaseDashboard\`; Insights shares hook with a lighter **insights** variant — see Phase 62.2 doc).
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
