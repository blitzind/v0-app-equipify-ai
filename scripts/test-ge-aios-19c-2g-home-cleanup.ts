/**
 * GE-AIOS-19C-2G — Home daily briefing cleanup certification.
 * Run: pnpm test:ge-aios-19c-2g-home-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_BRIEFING_CROSS_LINKS,
  GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER,
  GROWTH_HOME_CLEANUP_SECTION_AUDIT,
  GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS,
} from "../lib/growth/home/growth-home-cleanup-19c-2g"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_HOME_SURFACE_SECTION_AUDIT } from "../lib/growth/home/growth-home-surface-consolidation-17f"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "../lib/growth/training/growth-training-workspace-types"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "../lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "../lib/growth/ava-about/growth-ava-about-workspace-types"

const PHASE = "GE-AIOS-19C-2G" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Home daily briefing cleanup certification`)

  assert.equal(GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER, "ge-aios-19c-2g-home-cleanup-v1")
  assert.ok(GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS.includes("ava-hero"))
  assert.ok(GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS.includes("ava-work"))
  assert.ok(GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS.includes("waiting-on-you"))
  assert.ok(!GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS.includes("executive-snapshot"))
  console.log("  ✓ 19C-2G QA marker and primary briefing section audit")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeTrainingSetupCta/)
  assert.match(dashboard, /GrowthHomeBriefingCrossLinks/)
  assert.doesNotMatch(dashboard, /GrowthHomeStartAvaSetupSection dashboard=\{dashboard\} placement="primary"/)
  assert.doesNotMatch(dashboard, /GrowthHomeGrowthStrategySection/)
  assert.doesNotMatch(dashboard, /GrowthHomeAvaSpecialistTeamSection/)
  assert.match(dashboard, /GrowthHomeStartAvaSetupSection dashboard=\{dashboard\} placement="secondary"/)
  assert.match(dashboard, /data-qa-marker-19c-2g=\{GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER\}/)
  console.log("  ✓ Home dashboard is briefing-first (no primary wizard or training editors)")

  const primarySurface = dashboard.slice(
    dashboard.indexOf('data-qa-section="home-canonical-surface"'),
    dashboard.indexOf('sectionId="advanced-operations"'),
  )
  assert.doesNotMatch(primarySurface, /GrowthHomeExecutiveSnapshotSection/)
  assert.doesNotMatch(primarySurface, /GrowthHomeAvaOperatingRhythmSection/)
  assert.doesNotMatch(primarySurface, /GrowthHomeBusinessProfileSection/)
  assert.doesNotMatch(primarySurface, /GrowthHomeGrowthStrategySection/)
  console.log("  ✓ primary surface has no KPI wall or full training editors")

  const memory = readSource("components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx")
  assert.match(memory, /GROWTH_TRAINING_LEARNED_ROUTE/)
  assert.match(memory, /Full view in Training/)
  console.log("  ✓ learned section is teaser with Training link")

  const crossLinks = readSource("components/growth/workspace/executive-briefing/growth-home-briefing-cross-links.tsx")
  assert.match(crossLinks, /GROWTH_HOME_BRIEFING_CROSS_LINKS/)
  console.log("  ✓ briefing cross-links component")

  const linkHrefs = GROWTH_HOME_BRIEFING_CROSS_LINKS.map((row) => row.href)
  assert.ok(linkHrefs.includes(GROWTH_TRAINING_WORKSPACE_ROUTE))
  assert.ok(linkHrefs.includes(GROWTH_SALES_OPERATIONS_CENTER_ROUTE))
  assert.ok(linkHrefs.includes(GROWTH_AVA_ABOUT_WORKSPACE_ROUTE))
  assert.ok(linkHrefs.some((href) => /\/approvals/.test(href)))
  console.log("  ✓ cross-links cover Training, Operations, About, Approvals")

  const setupCta = readSource("components/growth/workspace/executive-briefing/growth-home-training-setup-cta.tsx")
  assert.doesNotMatch(setupCta, /fetch\(/)
  assert.match(setupCta, /GROWTH_TRAINING_WORKSPACE_ROUTE/)
  console.log("  ✓ compact Training CTA has no fetch (uses narrative signals)")

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /useGrowthWorkspaceDashboard/)
  assert.doesNotMatch(dashboardBody, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  console.log("  ✓ single workspace-summary fetch preserved via hook")

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.match(hook, /fetchGrowthHomeWorkspaceSummary/)
  console.log("  ✓ workspace-summary API path unchanged")

  const specialistTeam = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
  )
  assert.doesNotMatch(specialistTeam, /specialist_name/)
  console.log("  ✓ specialist identity section remains customer-safe if referenced elsewhere")

  const primaryAudit = GROWTH_HOME_SURFACE_SECTION_AUDIT.filter((row) => row.primary)
  assert.ok(primaryAudit.some((row) => row.id === "training-setup-cta"))
  assert.ok(!primaryAudit.some((row) => row.id === "executive-snapshot"))
  assert.ok(!primaryAudit.some((row) => row.id === "ava-specialist-team"))
  console.log("  ✓ surface consolidation audit aligned with 19C-2G")

  const dispositionIds = GROWTH_HOME_CLEANUP_SECTION_AUDIT.map((row) => row.id)
  assert.ok(dispositionIds.includes("research-growth-strategy"))
  assert.equal(
    GROWTH_HOME_CLEANUP_SECTION_AUDIT.find((row) => row.id === "research-growth-strategy")?.disposition,
    "move_training",
  )
  console.log("  ✓ cleanup audit documents Training relocation")

  console.log(`[${PHASE}] PASS — Home daily briefing cleanup certified (local)`)
}

main()
