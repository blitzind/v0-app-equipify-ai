/**
 * GE-AIOS-17F — Home surface consolidation certification.
 * Run: pnpm test:ge-aios-17f-home-surface-consolidation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_ADVANCED_OPERATIONS_TITLE,
  GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS,
  GROWTH_HOME_SETUP_DIAGNOSTICS_TITLE,
  GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER,
} from "../lib/growth/home/growth-home-surface-consolidation-17f"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-workspace-base-path"

const PHASE = "GE-AIOS-17F" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function indexOfComponent(source: string, componentName: string): number {
  const tag = `<${componentName}`
  const index = source.indexOf(tag)
  assert.ok(index >= 0, `Expected ${componentName} in dashboard source`)
  return index
}

function main(): void {
  console.log(`[${PHASE}] Home Surface Consolidation certification`)

  assert.equal(
    GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER,
    "ge-aios-17f-home-surface-consolidation-v1",
  )
  assert.deepEqual(GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS, [
    "ava-hero",
    "get-ava-ready",
    "ava-work",
    "ava-operating-rhythm",
    "ava-memory",
    "ava-specialist-team",
    "waiting-on-you",
    "executive-snapshot",
  ])

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  const body = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  const layout = readSource("app/(growth)/growth/layout.tsx")
  const debugFooter = readSource("components/growth/workspace/growth-home-debug-footer.tsx")
  const aidenGate = readSource("components/growth/growth-aiden-ask-launcher-gate.tsx")
  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  const page = readSource("app/(growth)/growth/page.tsx")

  assert.match(dashboard, /data-qa-marker-17f=\{GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER\}/)
  assert.match(dashboard, /data-qa-section="home-canonical-surface"/)
  assert.match(dashboard, /data-qa-section="home-advanced-operations"/)
  assert.match(dashboard, /data-qa-section="home-setup-diagnostics"/)
  assert.match(dashboard, /title=\{GROWTH_HOME_ADVANCED_OPERATIONS_TITLE\}/)
  assert.match(dashboard, /title=\{GROWTH_HOME_SETUP_DIAGNOSTICS_TITLE\}/)
  assert.doesNotMatch(dashboard, /sectionId="research-growth-strategy"[\s\S]*defaultOpen/)

  const heroIndex = indexOfComponent(dashboard, "GrowthHomeAvaHeroSection")
  const workIndex = indexOfComponent(dashboard, "GrowthHomeAvaWorkSection")
  const rhythmIndex = indexOfComponent(dashboard, "GrowthHomeAvaOperatingRhythmSection")
  const memoryIndex = indexOfComponent(dashboard, "GrowthHomeAvaMemorySection")
  const teamIndex = indexOfComponent(dashboard, "GrowthHomeAvaSpecialistTeamSection")
  const waitingIndex = indexOfComponent(dashboard, "GrowthHomeAiOsWaitingOnYouSection")
  const snapshotIndex = indexOfComponent(dashboard, "GrowthHomeExecutiveSnapshotSection")
  const advancedIndex = dashboard.indexOf('sectionId="advanced-operations"')
  const setupIndex = dashboard.indexOf('sectionId="setup-diagnostics"')
  const researchPanelIndex = indexOfComponent(dashboard, "GrowthHomeAvaResearchQueuePanel")
  const startAvaIndex = dashboard.indexOf('placement="primary"')
  const secondaryStartAvaIndex = dashboard.indexOf('placement="secondary"')

  assert.ok(heroIndex < workIndex)
  assert.ok(workIndex < rhythmIndex)
  assert.ok(rhythmIndex < memoryIndex)
  assert.ok(memoryIndex < teamIndex)
  assert.ok(teamIndex < waitingIndex)
  assert.ok(waitingIndex < snapshotIndex)
  assert.ok(snapshotIndex < advancedIndex)
  assert.ok(advancedIndex < setupIndex)
  assert.ok(researchPanelIndex > advancedIndex)
  assert.ok(startAvaIndex >= 0)
  assert.ok(startAvaIndex < workIndex)
  assert.ok(secondaryStartAvaIndex > setupIndex)

  assert.doesNotMatch(dashboard, /fetch\(/)
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.doesNotMatch(hook, /Promise\.all\(\[.*workspace-summary/)

  assert.match(body, /GrowthHomeDebugFooter/)
  assert.match(debugFooter, /HOME_DEBUG_FOOTER_ENABLED/)
  assert.match(debugFooter, /if \(!HOME_DEBUG_FOOTER_ENABLED\) return null/)

  assert.match(layout, /GrowthAidenAskLauncherGate/)
  assert.doesNotMatch(layout, /<AidenAskLauncher/)
  assert.match(aidenGate, /GROWTH_WORKSPACE_BASE_PATH/)
  assert.match(aidenGate, /return null/)

  assert.match(page, /daily operating report/i)
  assert.doesNotMatch(page, /pipeline, campaigns, and intelligence/i)

  const preservedComponents: Array<{ name: string; source: string }> = [
    { name: "GrowthHomeAvaResearchQueuePanel", source: dashboard },
    { name: "GrowthHomeStartAvaSetupSection", source: dashboard },
    { name: "GrowthHomeMissionCenterSection", source: dashboard },
    { name: "GrowthHomeCustomerSuccessMissionsSection", source: dashboard },
    { name: "GrowthHomeInitiativeRecommendationsSection", source: dashboard },
    { name: "GrowthHomeTimelineSection", source: dashboard },
    { name: "GrowthHomeMailboxDomainHealthSection", source: dashboard },
    { name: "GrowthHomeAvaLiveStatusSection", source: dashboard },
    { name: "GrowthHomeThroughputSection", source: dashboard },
    { name: "GrowthHomeCheckInSection", source: dashboard },
    { name: "RecentActivitySection", source: body },
    { name: "QuickActionsSection", source: body },
  ]
  for (const row of preservedComponents) {
    assert.match(row.source, new RegExp(row.name), `${row.name} must remain available on Home`)
  }

  assert.equal(GROWTH_WORKSPACE_BASE_PATH, "/growth")

  console.log(`[${PHASE}] PASS — Home surface consolidation certified (local)`)
  console.log("  ✓ Canonical Home sections render first")
  console.log("  ✓ Advanced operations + setup moved below the fold")
  console.log("  ✓ Debug footer hidden in production")
  console.log("  ✓ Aiden bubble hidden on /growth Home")
  console.log("  ✓ Single workspace-summary fetch preserved")
  console.log(`  ✓ QA marker: ${GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER}`)
}

main()
