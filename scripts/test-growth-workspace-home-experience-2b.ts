/**
 * GROWTH-WORKSPACE-HOME-EXPERIENCE-2B — Executive briefing presentation certification.
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
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

export { GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER }

const ROOT = process.cwd()

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist`)
  return fs.readFileSync(abs, "utf8")
}

function heroMain(source: string): string {
  return source.slice(source.indexOf("export function GrowthHomeExecutiveBriefingHeroSection"))
}

function main(): void {
  console.log(`\n=== GROWTH-WORKSPACE-HOME-EXPERIENCE-2B (${GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER, "growth-workspace-home-experience-2b-v1")
  assert.equal(GROWTH_HOME_TODAY_AT_A_GLANCE, "Today at a glance")
  assert.equal(GROWTH_HOME_NEEDS_YOUR_ATTENTION, "Needs your attention")
  assert.match(resolveAvaTeammateStatusLine("Waiting for approval"), /waiting for your approval/i)
  assert.equal(resolveHomeContextualIntroLine("morning"), "Here's what changed overnight.")
  assert.equal(resolveHomeDayPart(14), "afternoon")
  console.log("  ✓ Experience copy and time helpers")

  for (const file of GROWTH_HOME_EXPERIENCE_2B_SURFACES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
  }
  console.log("  ✓ Experience surfaces present")

  const heroFile = read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section.tsx")
  const hero = heroMain(heroFile)
  assert.match(heroFile, /GROWTH_HOME_AVA_RECOMMENDS/)
  assert.match(hero, /xl:grid-cols-2/)
  assert.ok(hero.indexOf('data-section="home-today-at-a-glance"') < hero.indexOf('data-section="home-hero-ava-recommends"'))
  assert.ok(hero.indexOf('data-section="home-hero-ava-recommends"') < hero.indexOf('data-section="home-executive-kpis"'))
  console.log("  ✓ Hero briefing order: glance → recommendation → supporting KPIs")

  const waiting = read("components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx")
  assert.match(waiting, /GROWTH_HOME_NEEDS_YOUR_ATTENTION/)
  assert.match(waiting, /GROWTH_HOME_CAUGHT_UP_TITLE/)
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

  console.log("\n  Running dashboard refinement 2A regression…\n")
  execSync("pnpm test:growth-workspace-dashboard-refinement-2a", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-HOME-EXPERIENCE-2B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
        glance_bullets: fixture.aiOsUx.hero.todayAtAGlance.length,
        ava_recommends: GROWTH_HOME_AVA_RECOMMENDS,
      },
      null,
      2,
    ),
  )
}

main()
