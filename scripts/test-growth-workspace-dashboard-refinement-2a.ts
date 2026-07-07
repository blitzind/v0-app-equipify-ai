/**
 * GROWTH-WORKSPACE-DASHBOARD-REFINEMENT-2A — Executive hero + objectives page certification.
 *
 * Run: pnpm test:growth-workspace-dashboard-refinement-2a
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_DASHBOARD_REFINEMENT_2A_SURFACES,
  GROWTH_HOME_HERO_AVA_RECOMMENDS,
  GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER,
} from "../lib/growth/workspace/executive-briefing/growth-home-dashboard-refinement-2a"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

export { GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER }

const ROOT = process.cwd()

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist`)
  return fs.readFileSync(abs, "utf8")
}

function main(): void {
  console.log(
    `\n=== GROWTH-WORKSPACE-DASHBOARD-REFINEMENT-2A (${GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER, "growth-workspace-dashboard-refinement-2a-v1")
  assert.equal(GROWTH_HOME_HERO_AVA_RECOMMENDS, "Ava recommends")
  console.log("  ✓ Refinement marker and hero copy")

  for (const file of GROWTH_DASHBOARD_REFINEMENT_2A_SURFACES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
  }
  console.log("  ✓ Refinement surfaces present")

  const heroSource = read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section.tsx")
  const snapshotSource = read("components/growth/workspace/executive-briefing/growth-home-executive-snapshot-section.tsx")
  assert.match(heroSource, /data-section="home-hero-ava-recommends"/)
  assert.match(snapshotSource, /data-section="home-executive-kpis"/)
  assert.match(heroSource, /GROWTH_HOME_AVA_RECOMMENDS|GROWTH_HOME_HERO_AVA_RECOMMENDS/)
  assert.doesNotMatch(heroSource, /bg-gradient-to-br from-indigo-50/)
  assert.doesNotMatch(heroSource, /bg-indigo-600/)
  assert.match(heroSource, /backdrop-blur/)
  console.log("  ✓ Executive hero uses compact premium layout with embedded Ava recommendation")

  const dashboardSource = read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
  assert.match(dashboardSource, /executiveRecommendation=\{briefing\.executiveRecommendation\}/)
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeExecutiveBriefingHeroSection") <
      dashboardSource.indexOf("<GrowthHomeAiOsWaitingOnYouSection"),
    "Hero must render before waiting-on-you section",
  )
  assert.ok(
    dashboardSource.indexOf("executiveRecommendation=") <
      dashboardSource.indexOf("<GrowthHomeThroughputSection"),
    "Recommendation props must be wired before throughput metrics",
  )
  console.log("  ✓ Dashboard keeps recommendation above supporting metrics")

  const synthesizerSource = read("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
  assert.match(synthesizerSource, /executiveKpis/)
  assert.match(synthesizerSource, /opportunityAction/)
  assert.match(synthesizerSource, /riskAction/)
  console.log("  ✓ Hero synthesizer exposes executive KPI and action cards")

  const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
  assert.ok(fixture.aiOsUx.hero.executiveKpis.length > 0)
  assert.ok(fixture.aiOsUx.hero.opportunityAction || fixture.aiOsUx.hero.biggestOpportunity)
  console.log("  ✓ Cert fixture includes executive KPI cards")

  const objectivesDashboard = read("components/growth/objectives/growth-objectives-dashboard.tsx")
  assert.match(
    objectivesDashboard,
    /from "@\/lib\/growth\/objectives\/growth-objective-types"/,
    "Objectives dashboard must not import server-only objective service module",
  )
  assert.doesNotMatch(objectivesDashboard, /growth-objective-service/)
  assert.match(read("lib/growth/objectives/growth-objective-types.ts"), /GrowthObjectiveDashboardModel/)
  console.log("  ✓ Objectives page client bundle avoids server-only service import")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\n  Running GE-AIOS-UX-1A regression…\n")
  execSync("pnpm test:ge-aios-ux-1a-ai-os-home-experience", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running GE-AI-UX-1C regression…\n")
  execSync("pnpm test:ge-ai-ux-1c-ai-executive-briefing-experience", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running GROWTH-WORKSPACE-ACTION-FIRST-1F regression…\n")
  execSync("pnpm test:growth-workspace-action-first-1f", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-DASHBOARD-REFINEMENT-2A verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER,
        hero_kpis: fixture.aiOsUx.hero.executiveKpis.length,
        objectives_fix: "GrowthObjectiveDashboardModel moved to client-safe types module",
      },
      null,
      2,
    ),
  )
}

main()
