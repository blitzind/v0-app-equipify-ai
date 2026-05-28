/**
 * Regression checks for Growth Engine sidebar navigation polish (growth-sidebar-nav-v2 + IA v2 + polish v1).
 * Run: pnpm test:growth-sidebar-nav
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SIDEBAR_FLYOUT_QA_MARKER,
  GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY,
  GROWTH_SIDEBAR_NAV_QA_MARKER,
} from "../components/growth/growth-section-sidebar-nav"
import {
  GROWTH_NAV_GROUP_DEFS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
  GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER,
  resolveGrowthNavigationEntryFromPathname,
} from "../lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_COMMAND_REGISTRY } from "../lib/growth/navigation/growth-command-registry"
import { GROWTH_NAVIGATION_POLISH_QA_MARKER } from "../lib/growth/navigation/growth-navigation-ranking"
import { APP_Z_GROWTH_NAV_FLYOUT } from "../lib/layout/app-z-layers"

assert.equal(GROWTH_SIDEBAR_NAV_QA_MARKER, "growth-sidebar-nav-v2")
assert.equal(GROWTH_SIDEBAR_FLYOUT_QA_MARKER, "growth-sidebar-flyout-zindex-v1")
assert.equal(GROWTH_NAVIGATION_IA_QA_MARKER, "growth-navigation-ia-v2")
assert.equal(GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER, "growth-nav-lead-intelligence-single-home-v1")
assert.equal(GROWTH_NAVIGATION_POLISH_QA_MARKER, "growth-navigation-polish-v1")
assert.match(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY, /groups-collapsed/)

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
assert.match(source, /clickableNavItems\(group\)\.some/)
assert.match(source, /pipeline: Funnel/)

const coreGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "core")
assert.ok(coreGroup?.items.some((i) => i.label === "Revenue Inbox"))
assert.ok(coreGroup?.items.some((i) => i.label === "Inbox"))
assert.ok(coreGroup?.items.some((i) => i.label === "Prospect Search"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Intent Signals"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Sequence Execution"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Outreach Approval"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Imports"))

const intelligenceGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "intelligence")
assert.equal(intelligenceGroup?.label, "Intelligence")
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Intent Signals"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Lead Intelligence"))
assert.ok(!intelligenceGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(intelligenceGroup?.items.some((i) => i.label === "Revenue Intelligence"))

const executionGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "execution")
assert.equal(executionGroup?.label, "Execution")
assert.ok(executionGroup?.items.some((i) => i.label === "Call Workspace"))
assert.ok(executionGroup?.items.some((i) => i.label === "Outreach Approval"))
assert.ok(executionGroup?.items.some((i) => i.label === "Sequence Execution"))
assert.ok(executionGroup?.items.some((i) => i.label === "Live Coaching"))
assert.ok(executionGroup?.items.some((i) => i.label === "Call Providers"))

const leadEngineGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "lead-engine")
assert.equal(leadEngineGroup?.label, "Lead Engine")
assert.ok(leadEngineGroup?.items.some((i) => i.label === "CRM Leads"))
assert.ok(!leadEngineGroup?.items.some((i) => i.label === "Discover Companies"))
assert.ok(leadEngineGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(leadEngineGroup?.items.some((i) => i.label === "Imports"))

const providersGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "providers-nav")
assert.equal(providersGroup?.label, "Operations")
assert.ok(providersGroup?.items.some((i) => i.label === "Outbound Console"))
assert.ok(providersGroup?.items.some((i) => i.label === "Protection"))
assert.ok(providersGroup?.items.some((i) => i.label === "DNS & Setup"))
assert.ok(providersGroup?.items.some((i) => i.label === "Deliverability Ops"))
assert.ok(providersGroup?.items.some((i) => i.label === "Delivery"))
assert.ok(providersGroup?.items.some((i) => i.label === "Compliance"))
assert.ok(providersGroup?.items.some((i) => i.label === "Webhooks"))
assert.ok(providersGroup?.items.some((i) => i.label === "Diagnostics (Advanced)"))
assert.ok(providersGroup?.items.some((i) => i.label === "Mailbox Connections"))
assert.ok(!providersGroup?.items.some((i) => i.label === "Provider Diagnostics"))

const aiGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "ai")
assert.equal(aiGroup?.label, "AI")
assert.ok(aiGroup?.items.some((i) => i.label === "Copilot"))
assert.ok(aiGroup?.items.some((i) => i.label === "Playbooks"))
assert.ok(!aiGroup?.items.some((i) => i.href === "/admin/growth/leads/lead-engine"))

const leadEnginePath = "/admin/growth/leads/lead-engine"
const resolvedLeadEngine = resolveGrowthNavigationEntryFromPathname(leadEnginePath)
assert.equal(resolvedLeadEngine?.id, "lead-engine-inspector")
assert.equal(resolvedLeadEngine?.label, "Lead Intelligence Inspector")

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
