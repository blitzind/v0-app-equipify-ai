/**
 * Regression checks for Growth Engine sidebar navigation polish (growth-sidebar-nav-v2 + IA v2 + polish v1).
 * Run: pnpm test:growth-sidebar-nav
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY,
  GROWTH_SIDEBAR_NAV_QA_MARKER,
} from "../components/growth/growth-section-sidebar-nav"
import {
  GROWTH_NAV_GROUP_DEFS,
  GROWTH_NAV_QUICK_ACTIONS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
} from "../lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_NAVIGATION_POLISH_QA_MARKER } from "../lib/growth/navigation/growth-navigation-ranking"

assert.equal(GROWTH_SIDEBAR_NAV_QA_MARKER, "growth-sidebar-nav-v2")
assert.equal(GROWTH_NAVIGATION_IA_QA_MARKER, "growth-navigation-ia-v2")
assert.equal(GROWTH_NAVIGATION_POLISH_QA_MARKER, "growth-navigation-polish-v1")
assert.match(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY, /groups-collapsed/)

const source = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
  "utf8",
)

assert.match(source, /ChevronDown/)
assert.match(source, /useGrowthSidebarGroupCollapse/)
assert.match(source, /GROWTH_NAV_GROUP_DEFS/)
assert.match(source, /GROWTH_NAVIGATION_IA_QA_MARKER/)
assert.match(source, /GROWTH_NAVIGATION_POLISH_QA_MARKER/)
assert.match(source, /GROWTH_NAV_QUICK_ACTIONS/)
assert.match(source, /growthNavigationShortcutLabel/)
assert.doesNotMatch(source, /Run Research/)
assert.doesNotMatch(source, /Generate Copilot Draft/)
assert.match(source, /dark:bg-slate-800/)
assert.match(source, /data-qa-marker=\{GROWTH_SIDEBAR_NAV_QA_MARKER\}/)
assert.match(source, /aria-expanded=\{!groupCollapsed\}/)
assert.match(source, /TooltipContent side="right"/)

const coreGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "core")
assert.ok(coreGroup?.items.some((i) => i.label === "Revenue Inbox"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(!coreGroup?.items.some((i) => i.label === "Imports"))

const workflowGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "workflow")
assert.ok(workflowGroup?.items.some((i) => i.label === "Outreach Approval"))
assert.ok(!workflowGroup?.items.some((i) => i.label === "Reply Inbox"))

const communicationGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "communication")
assert.equal(communicationGroup?.label, "Communication")
assert.ok(communicationGroup?.items.some((i) => i.label === "Call Queue"))

const coachingGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "coaching")
assert.equal(coachingGroup?.label, "Coaching")

const toolsGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "tools")
assert.ok(toolsGroup?.items.some((i) => i.label === "Lead Intelligence Inspector"))
assert.ok(toolsGroup?.items.some((i) => i.label === "CRM Leads"))
assert.ok(toolsGroup?.items.some((i) => i.label === "Provider Diagnostics"))
assert.ok(toolsGroup?.items.some((i) => i.label === "Imports"))
assert.ok(toolsGroup?.items.some((i) => i.label === "Playbooks"))

assert.ok(GROWTH_NAV_QUICK_ACTIONS.some((a) => a.label === "Discover Companies"))

const consoleSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/use-growth-sidebar-console.ts"),
  "utf8",
)
assert.match(consoleSource, /lead-inbox/)
assert.match(consoleSource, /outreach\/approval-dashboard/)
assert.match(consoleSource, /intent-pixel\/monitor/)
assert.match(consoleSource, /intent_pixel/)
assert.match(consoleSource, /outreach_approval/)

const layoutSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-layout.tsx"),
  "utf8",
)
assert.match(layoutSource, /GrowthSectionSidebarNav/)

console.log("growth-sidebar-nav: all checks passed")
