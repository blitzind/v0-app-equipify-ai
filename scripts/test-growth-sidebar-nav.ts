/**
 * Regression checks for Growth Engine sidebar navigation polish (growth-sidebar-nav-v2).
 * Run: pnpm test:growth-sidebar-nav
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY,
  GROWTH_SIDEBAR_NAV_QA_MARKER,
} from "../components/growth/growth-section-sidebar-nav"

assert.equal(GROWTH_SIDEBAR_NAV_QA_MARKER, "growth-sidebar-nav-v2")
assert.match(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY, /groups-collapsed/)

const source = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
  "utf8",
)

assert.match(source, /ChevronDown/)
assert.match(source, /useGrowthSidebarGroupCollapse/)
assert.match(source, /groupHasActiveRoute/)
assert.match(source, /readCollapsedGrowthGroups/)
assert.match(source, /writeCollapsedGrowthGroups/)
assert.match(source, /dark:bg-slate-800/)
assert.match(source, /dark:border-cyan-500/)
assert.match(source, /GROWTH_NAV_ACTIVE_RAIL/)
assert.match(source, /\/admin\/growth\/intent-pixel/)
assert.match(source, /Intent Pixel/)
assert.match(source, /quick-actions/)
assert.match(source, /data-qa-marker=\{GROWTH_SIDEBAR_NAV_QA_MARKER\}/)
assert.match(source, /aria-expanded=\{!groupCollapsed\}/)
assert.doesNotMatch(source, /border-emerald-200 bg-emerald-50 text-emerald-800/)

const layoutSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-layout.tsx"),
  "utf8",
)
assert.match(layoutSource, /GrowthSectionSidebarNav/)

console.log("growth-sidebar-nav: all checks passed")
