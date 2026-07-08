/**
 * GROWTH-WORKSPACE-HOME-EXPERIENCE-2B — Home experience presentation certification.
 *
 * GE-AIOS-7B — Updated to validate the unified Ava hero (7A) instead of the retired
 * GrowthHomeExecutiveBriefingHeroSection.
 *
 * Run: pnpm test:growth-workspace-home-experience-2b
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_AVA_RECOMMENDS,
  GROWTH_HOME_NEEDS_YOUR_ATTENTION,
  GROWTH_HOME_TODAY_AT_A_GLANCE,
  GROWTH_HOME_EXPERIENCE_2B_SURFACES,
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
  resolveAvaTeammateStatusLine,
  resolveHomeContextualIntroLine,
  resolveHomeDayPart,
} from "../lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { GROWTH_HOME_AVA_HERO_7A_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

export { GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER }

const ROOT = process.cwd()

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist`)
  return fs.readFileSync(abs, "utf8")
}

function main(): void {
  console.log(`\n=== GROWTH-WORKSPACE-HOME-EXPERIENCE-2B (${GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER, "growth-workspace-home-experience-2b-v1")
  assert.equal(GROWTH_HOME_TODAY_AT_A_GLANCE, "Today at a glance")
  assert.equal(GROWTH_HOME_NEEDS_YOUR_ATTENTION, "Needs Your Decision")
  assert.match(resolveAvaTeammateStatusLine("Waiting for approval"), /waiting for your approval/i)
  assert.equal(resolveHomeContextualIntroLine("morning"), "Here's what changed overnight.")
  assert.equal(resolveHomeDayPart(14), "afternoon")
  console.log("  ✓ Experience copy and time helpers")

  for (const file of GROWTH_HOME_EXPERIENCE_2B_SURFACES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
  }
  console.log("  ✓ Experience surfaces present")

  // GE-AIOS-7B — retired old hero; unified Ava hero is the canonical Home hero.
  const oldHeroPath = path.join(
    ROOT,
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section.tsx",
  )
  assert.ok(!fs.existsSync(oldHeroPath), "retired GrowthHomeExecutiveBriefingHeroSection must not exist")

  const heroFile = read("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroFile, /export function GrowthHomeAvaHeroSection/)
  assert.match(heroFile, /data-qa-section="home-ava-hero"/)
  assert.match(heroFile, /GROWTH_HOME_AVA_CURRENTLY_TITLE/)
  assert.match(heroFile, /GROWTH_HOME_AVA_ONE_THING_TITLE/)
  assert.match(heroFile, /GROWTH_HOME_AVA_SINCE_LAST_VISIT_TITLE/)
  assert.doesNotMatch(heroFile, /bg-indigo-600/)
  assert.match(heroFile, /backdrop-blur/)
  console.log("  ✓ Unified Ava hero (7A) replaces retired executive briefing hero")

  const dashboard = read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
  assert.match(dashboard, /<GrowthHomeAvaHeroSection/)
  assert.doesNotMatch(dashboard, /GrowthHomeExecutiveBriefingHeroSection/)
  assert.match(dashboard, /<GrowthHomeCollapsibleSection/)
  assert.match(dashboard, /<GrowthHomeExecutiveSnapshotSection/)
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaHeroSection") < dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection"),
    "Hero must render before Needs Your Decision",
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection") < dashboard.indexOf("<GrowthHomeExecutiveSnapshotSection"),
    "Needs Your Decision must render before Revenue Queue summary",
  )
  console.log("  ✓ Dashboard layout: hero → needs → revenue queue summary → collapsible sections")

  const collapsible = read("components/growth/workspace/executive-briefing/growth-home-collapsible-section.tsx")
  assert.match(collapsible, /GROWTH_HOME_SECTION_COLLAPSE_KEY/)
  assert.match(collapsible, /localStorage/)
  console.log("  ✓ Collapsible sections remember expand/collapse state")

  const body = read("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(body, /useGrowthWorkspaceDashboard/)
  const fetchMatches = body.match(/fetch\(/g) ?? []
  assert.equal(fetchMatches.length, 0, "Home must not add new fetch calls beyond workspace summary")
  console.log("  ✓ Home uses one workspace-summary request")

  const waiting = read("components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx")
  assert.match(waiting, /GROWTH_HOME_NEEDS_YOUR_ATTENTION/)
  assert.match(waiting, /GROWTH_HOME_NOTHING_REQUIRES_APPROVAL/)
  assert.match(waiting, /home-needs-your-attention/)
  assert.doesNotMatch(waiting, /AI_OWNERSHIP_WAITING_ON_YOU_TITLE/)
  console.log("  ✓ Needs your attention section with caught-up empty state")

  const synthesizer = read("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
  assert.match(synthesizer, /todayAtAGlance/)
  assert.match(synthesizer, /GROWTH_HOME_KPI_AVA_CONFIDENCE/)
  assert.match(synthesizer, /GROWTH_HOME_KPI_PIPELINE_IMPACT/)
  console.log("  ✓ Synthesizer builds glance bullets and teammate KPI labels")

  const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
  assert.ok(fixture.aiOsUx.hero.todayAtAGlance.length > 0)
  console.log("  ✓ Cert fixture includes today-at-a-glance bullets")

  const objectives = read("components/growth/objectives/growth-objectives-dashboard.tsx")
  assert.doesNotMatch(objectives, /growth-objective-service/)
  console.log("  ✓ Objectives page remains client-safe")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")

  console.log("\n  Running GE-AIOS-7A regression…\n")
  execSync("pnpm test:ge-aios-7a-ava-home-experience", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running dashboard refinement 2A regression…\n")
  execSync("pnpm test:growth-workspace-dashboard-refinement-2a", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-HOME-EXPERIENCE-2B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
        ava_hero_7a_marker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
        glance_bullets: fixture.aiOsUx.hero.todayAtAGlance.length,
        ava_recommends: GROWTH_HOME_AVA_RECOMMENDS,
        old_hero_retired: true,
      },
      null,
      2,
    ),
  )
}

main()
