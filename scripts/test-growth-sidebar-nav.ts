/**
 * Regression checks for Growth Engine sidebar navigation polish (growth-sidebar-nav-v2 + IA v2 + polish v1).
 * Run: pnpm test:growth-sidebar-nav
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_INTELLIGENCE_NAV_CLEANUP_QA_MARKER,
  GROWTH_WORKSPACE_QUEUE_QA_MARKER,
  GROWTH_NAV_GROUP_DEFS,
  GROWTH_DELIVERY_OPS_NAV_QA_MARKER,
  GROWTH_DELIVERY_OPS_NAV_SECTIONS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
  GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
  resolveGrowthNavigationEntryFromPathname,
} from "../lib/growth/navigation/growth-navigation-destinations"
import {
  GROWTH_SIDEBAR_FLYOUT_QA_MARKER,
  GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY,
  GROWTH_SIDEBAR_NAV_QA_MARKER,
} from "../components/growth/growth-section-sidebar-nav"
import { GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER } from "../lib/growth/navigation/growth-workspace-consolidation"
import { GROWTH_COMMAND_REGISTRY } from "../lib/growth/navigation/growth-command-registry"
import { GROWTH_NAVIGATION_POLISH_QA_MARKER } from "../lib/growth/navigation/growth-navigation-ranking"
import { APP_Z_GROWTH_NAV_FLYOUT } from "../lib/layout/app-z-layers"

assert.equal(GROWTH_SIDEBAR_NAV_QA_MARKER, "growth-sidebar-nav-v2")
assert.equal(GROWTH_SIDEBAR_FLYOUT_QA_MARKER, "growth-sidebar-flyout-zindex-v1")
assert.equal(GROWTH_NAVIGATION_IA_QA_MARKER, "growth-navigation-ia-v2")
assert.equal(GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER, "growth-nav-lead-intelligence-single-home-v1")
assert.equal(GROWTH_NAVIGATION_POLISH_QA_MARKER, "growth-navigation-polish-v1")
assert.match(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY, /groups-collapsed/)

assert.equal(GROWTH_WORKSPACE_QUEUE_QA_MARKER, "growth-workspace-queue-v1")
assert.equal(GROWTH_INTELLIGENCE_NAV_CLEANUP_QA_MARKER, "growth-intelligence-nav-cleanup-v1")

const queuePageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/queue/page.tsx"),
  "utf8",
)
assert.match(queuePageSource, /Revenue Queue/)
assert.match(queuePageSource, /GROWTH_WORKSPACE_QUEUE_QA_MARKER/)

const legacyLeadsPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/leads/page.tsx"),
  "utf8",
)
assert.match(legacyLeadsPageSource, /redirect/)
assert.match(legacyLeadsPageSource, /GROWTH_REVENUE_QUEUE_HREF/)

const source = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
  "utf8",
)

assert.match(source, /ChevronDown/)
assert.match(source, /ChevronRight/)
assert.match(source, /useGrowthSidebarGroupCollapse/)
assert.match(source, /useGrowthNavFlyout/)
assert.match(source, /GrowthNavFlyoutPanel/)
assert.match(source, /GrowthNavFlyoutPortal/)
assert.match(source, /createPortal/)
assert.match(source, /document\.body/)
assert.match(source, /APP_Z_GROWTH_NAV_FLYOUT/)
assert.match(source, /data-flyout-layer="growth-nav-flyout"/)
assert.match(source, /data-flyout-bridge="growth-nav-flyout"/)
assert.match(source, /useGrowthNavFlyoutAnchor/)
assert.doesNotMatch(source, /left-\[calc\(100%\+6px\)\]/)
assert.equal(APP_Z_GROWTH_NAV_FLYOUT, "z-[120]")
assert.match(source, /GrowthNavSectionRow/)
assert.match(source, /GrowthNavFlyoutSections/)
assert.match(source, /clickableNavItems/)
assert.match(source, /GROWTH_NAV_GROUP_DEFS/)
assert.match(source, /core: Bolt/)
assert.match(source, /GROWTH_SIDEBAR_FLYOUT_QA_MARKER/)
assert.match(source, /data-flyout-marker=\{GROWTH_SIDEBAR_FLYOUT_QA_MARKER\}/)
assert.match(source, /GROWTH_NAVIGATION_IA_QA_MARKER/)
assert.match(source, /GROWTH_NAVIGATION_POLISH_QA_MARKER/)
assert.match(source, /growthNavigationShortcutLabel/)
assert.match(source, /Open Inbox/)
assert.match(source, /Pending Approval/)
assert.match(source, /Active Sequences/)
assert.match(source, /Critical Signals/)
assert.match(source, /System Health/)
assert.doesNotMatch(source, /Quick Actions/)
assert.doesNotMatch(source, /GROWTH_NAV_QUICK_ACTIONS/)
assert.doesNotMatch(source, /Run Research/)
assert.doesNotMatch(source, /Generate Copilot Draft/)
assert.match(source, /dark:bg-slate-800/)
assert.match(source, /data-qa-marker=\{GROWTH_SIDEBAR_NAV_QA_MARKER\}/)
assert.match(source, /aria-expanded=\{flyoutOpen\}/)
assert.match(source, /aria-haspopup="menu"/)
assert.match(source, /role="menu"/)
assert.match(source, /scheduleClose/)
assert.match(source, /Escape/)
assert.match(source, /TooltipContent side="right"/)
assert.match(source, /resolveNavBadge/)
assert.match(source, /safeMatchGrowthNavItem/)
assert.match(source, /normalizeGrowthPathname/)
assert.match(source, /GrowthSidebarNavErrorBoundary/)
assert.match(source, /futurePlaceholder/)
assert.match(source, /lg:hidden/)
assert.match(source, /data-qa=\{GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER\}/)
assert.match(source, /GrowthNavGroupedLinks/)
assert.match(source, /GrowthNavSubsectionHeader/)
assert.match(source, /GROWTH_DELIVERY_OPS_NAV_QA_MARKER/)
assert.equal(GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER, "growth-workspace-consolidation-v2")
assert.equal(GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER, "growth-calls-runtime-hardening-v1")
assert.match(source, /data-workspace-consolidation-marker/)
assert.match(source, /GROWTH_WORKSPACE_GROUP_DESCRIPTION/)
assert.match(source, /GROWTH_INTELLIGENCE_NAV_CLEANUP_QA_MARKER/)
assert.match(source, /data-intelligence-nav-cleanup-marker/)
assert.match(source, /data-lead-pipeline-ia-marker/)
assert.match(source, /search: Search/)

const coreGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "core")
assert.equal(coreGroup?.label, "Workspace")
assert.ok(coreGroup?.items.some((i) => i.label === "Queue"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Revenue Inbox"))
assert.ok(coreGroup?.items.some((i) => i.label === "Inbox"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Prospect Search"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Outreach"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Sequences"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Intent Signals"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Sequence Execution"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Outreach Approval"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Lead Pipeline"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Imports"))

const leadEngineGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "lead-engine")
assert.equal(leadEngineGroup?.label, "Lead Engine")
assert.equal(GROWTH_NAV_GROUP_DEFS[1]?.id, "lead-engine")
assert.ok(leadEngineGroup?.items.some((i) => i.label === "Prospect Search"))
assert.ok(leadEngineGroup?.items.some((i) => i.label === "CRM Leads"))
assert.ok(!leadEngineGroup?.items.some((i) => i.label === "Discover Companies"))
assert.ok(leadEngineGroup?.items.some((i) => i.label === "Lead Pipeline"))
assert.ok(!leadEngineGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(leadEngineGroup?.items.some((i) => i.label === "Imports"))

const intelligenceGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "intelligence")
assert.equal(intelligenceGroup?.label, "Intelligence")
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Intent Signals"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Lead Intelligence"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Lead Pipeline"))
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Revenue"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Revenue Intelligence"))
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Opportunities"))
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Forecast"))

const executionGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "execution")
assert.equal(executionGroup?.label, "Execution")
assert.ok(executionGroup?.items.some((i) => i.label === "Outreach"))
assert.ok(executionGroup?.items.some((i) => i.label === "Sequences"))
assert.ok(!executionGroup?.items.some((i) => i.label === "Call Workspace"))
assert.ok(executionGroup?.items.some((i) => i.label === "Outreach Approval"))
assert.ok(executionGroup?.items.some((i) => i.label === "Sequence Execution"))
assert.ok(!executionGroup?.items.some((i) => i.label === "Live Coaching"))
assert.ok(!executionGroup?.items.some((i) => i.label === "Call Providers"))

const callsItem = coreGroup?.items.find((i) => i.id === "calls")
assert.equal(callsItem?.href, "/admin/growth/calls/workspace")
assert.equal(callsItem?.match("/admin/growth/calls/workspace"), true)
assert.equal(callsItem?.match("/admin/growth/calls/live"), true)
assert.equal(callsItem?.match("/admin/growth/calls/providers"), false)

const providersGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "providers-nav")
assert.equal(providersGroup?.label, "Delivery Ops")
assert.equal(GROWTH_DELIVERY_OPS_NAV_QA_MARKER, "growth-delivery-ops-nav-v1")
assert.ok(providersGroup?.items.some((i) => i.label === "Outbound Console"))
assert.ok(providersGroup?.items.some((i) => i.label === "Provider Connections"))
assert.ok(providersGroup?.items.some((i) => i.label === "Outbound Readiness"))
assert.ok(providersGroup?.items.some((i) => i.label === "Sender Management"))
assert.ok(providersGroup?.items.some((i) => i.label === "Deliverability"))
assert.ok(providersGroup?.items.some((i) => i.label === "Protection"))
assert.ok(providersGroup?.items.some((i) => i.label === "Warmup"))
assert.ok(providersGroup?.items.some((i) => i.label === "Compliance"))
assert.ok(providersGroup?.items.some((i) => i.label === "Webhooks"))
assert.ok(providersGroup?.items.some((i) => i.label === "Diagnostics"))
assert.ok(providersGroup?.items.some((i) => i.label === "Mailbox Connections"))
assert.ok(providersGroup?.items.some((i) => i.label === "Sender Pools"))
assert.ok(!providersGroup?.items.some((i) => i.label === "DNS & Setup"))
assert.ok(!providersGroup?.items.some((i) => i.label === "Setup"))
assert.ok(!providersGroup?.items.some((i) => i.label === "Diagnostics (Advanced)"))

const deliveryOpsSections = providersGroup?.items
  .map((item) => item.section)
  .filter((section): section is string => Boolean(section))
assert.ok(deliveryOpsSections?.includes(GROWTH_DELIVERY_OPS_NAV_SECTIONS.configuration))
assert.ok(deliveryOpsSections?.includes(GROWTH_DELIVERY_OPS_NAV_SECTIONS.sendingAssets))
assert.ok(deliveryOpsSections?.includes(GROWTH_DELIVERY_OPS_NAV_SECTIONS.deliverability))
assert.ok(deliveryOpsSections?.includes(GROWTH_DELIVERY_OPS_NAV_SECTIONS.system))
assert.equal(providersGroup?.items[0]?.label, "Outbound Console")
assert.equal(providersGroup?.items[0]?.section, undefined)

const aiGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "ai")
assert.equal(aiGroup?.label, "Copilot")
assert.ok(aiGroup?.items.some((i) => i.label === "Copilot"))
assert.ok(aiGroup?.items.some((i) => i.label === "Playbooks"))
assert.ok(!aiGroup?.items.some((i) => i.href === "/admin/growth/leads/lead-engine"))

const leadEnginePath = "/admin/growth/leads/lead-engine"
const resolvedLeadEngine = resolveGrowthNavigationEntryFromPathname(leadEnginePath)
assert.equal(resolvedLeadEngine?.id, "lead-engine-inspector")
assert.equal(resolvedLeadEngine?.label, "Lead Pipeline")

const resolvedProspectSearch = resolveGrowthNavigationEntryFromPathname("/admin/growth/search")
assert.equal(resolvedProspectSearch?.id, "prospect-search")

const intelligenceActive = intelligenceGroup?.items.some(
  (item) => !item.futurePlaceholder && item.match(leadEnginePath),
)
const aiActive = aiGroup?.items.some((item) => !item.futurePlaceholder && item.match(leadEnginePath))
const leadEngineActive = leadEngineGroup?.items.some(
  (item) => !item.futurePlaceholder && item.match(leadEnginePath),
)
assert.equal(intelligenceActive, false)
assert.equal(aiActive, false)
assert.equal(leadEngineActive, true)

const settingsGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "settings")
assert.ok(settingsGroup?.items.some((i) => i.label === "Growth"))
assert.ok(settingsGroup?.items.some((i) => i.label === "Communications"))
assert.ok(settingsGroup?.items.some((i) => i.label === "Providers"))
assert.ok(settingsGroup?.items.some((i) => i.label === "Provider Health"))
assert.ok(settingsGroup?.items.some((i) => i.label === "Governance"))

const growthSettingsItem = settingsGroup?.items.find((i) => i.id === "growth-settings")
const communicationsItem = settingsGroup?.items.find((i) => i.id === "communication-settings")
const providerHealthItem = settingsGroup?.items.find((i) => i.id === "provider-health")
const governanceItem = settingsGroup?.items.find((i) => i.id === "governance")
assert.ok(growthSettingsItem?.match("/admin/growth/settings/growth"))
assert.ok(growthSettingsItem?.match("/admin/growth/settings"))
assert.equal(growthSettingsItem?.match("/admin/growth/settings/governance"), false)
assert.equal(growthSettingsItem?.match("/admin/growth/settings/provider-health"), false)
assert.ok(communicationsItem?.match("/admin/growth/settings/communications"))
assert.equal(communicationsItem?.match("/admin/growth/settings/growth"), false)
assert.ok(providerHealthItem?.match("/admin/growth/settings/provider-health"))
assert.equal(providerHealthItem?.match("/admin/growth/settings/governance"), false)
assert.equal(providerHealthItem?.match("/admin/growth/settings/growth"), false)
assert.ok(governanceItem?.match("/admin/growth/settings/governance"))
assert.equal(governanceItem?.match("/admin/growth/settings/provider-health"), false)
assert.equal(governanceItem?.match("/admin/growth/settings/growth"), false)

const groupOrder = GROWTH_NAV_GROUP_DEFS.map((group) => group.label)
assert.deepEqual(groupOrder, [
  "Workspace",
  "Lead Engine",
  "Intelligence",
  "Execution",
  "Delivery Ops",
  "Copilot",
  "Settings",
])

assert.ok(GROWTH_COMMAND_REGISTRY.some((a) => a.label === "Prospect Search"))
assert.ok(!GROWTH_COMMAND_REGISTRY.some((a) => a.label === "Discover Companies"))

const navIds = GROWTH_NAV_GROUP_DEFS.flatMap((group) => group.items.map((item) => item.id))
assert.equal(navIds.length, new Set(navIds).size, "duplicate sidebar nav ids")

const consoleSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/use-growth-sidebar-console.ts"),
  "utf8",
)
assert.match(consoleSource, /lead-inbox/)
assert.match(consoleSource, /inbox\/dashboard/)
assert.match(consoleSource, /sequences\/dashboard/)
assert.match(consoleSource, /outreach\/approval-dashboard/)
assert.match(consoleSource, /intent-pixel\/monitor/)
assert.match(consoleSource, /openInbox/)
assert.match(consoleSource, /pendingApproval/)
assert.match(consoleSource, /activeSequences/)
assert.match(consoleSource, /criticalSignals/)
assert.match(consoleSource, /systemHealthLabel/)
assert.match(consoleSource, /degraded/)
assert.match(consoleSource, /GrowthSidebarConsole failed/)

const layoutSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-layout.tsx"),
  "utf8",
)
assert.match(layoutSource, /GrowthSectionSidebarNav/)
assert.match(layoutSource, /GrowthOperatorAttentionStrip/)

const zLayerSource = fs.readFileSync(path.join(process.cwd(), "lib/layout/app-z-layers.ts"), "utf8")
assert.match(zLayerSource, /APP_Z_GROWTH_NAV_FLYOUT/)
assert.match(zLayerSource, /z-\[120\]/)
assert.match(zLayerSource, /APP_Z_DIALOG/)
assert.match(zLayerSource, /z-\[150\]/)

console.log("growth-sidebar-nav: all checks passed")
