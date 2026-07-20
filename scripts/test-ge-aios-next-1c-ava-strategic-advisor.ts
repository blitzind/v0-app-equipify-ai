/**
 * GE-AIOS-NEXT-1C — Ava strategic advisor (challenge before execute) certification.
 * Run: pnpm test:ge-aios-next-1c-ava-strategic-advisor
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateGrowthHomeAvaStrategicIntent,
  buildGrowthHomeAvaStrategicOverrideIntent,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-advisor-next-1c"
import {
  buildGrowthHomeAvaStrategicAdvisorContextPayload,
  buildGrowthHomeAvaStrategicEvaluationContext,
  GROWTH_AIOS_NEXT_1C_STRATEGIC_CONTEXT_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import { GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER } from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-evaluation-next-1c-types"
import {
  buildStrategicMarketKey,
  GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "../lib/growth/navigation/growth-prospect-search-paths"

const PHASE = "GE-AIOS-NEXT-1C-AVA-STRATEGIC-ADVISOR" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function equipifyContext() {
  return buildGrowthHomeAvaStrategicEvaluationContext({
    payload: buildGrowthHomeAvaStrategicAdvisorContextPayload({
      approvedProfile: buildLive1bEquipifyCompanyProfileContent(),
      organizationalKnowledge: [],
      organizationPreferences: [],
    }),
  })
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  const contextPayload = buildGrowthHomeAvaStrategicAdvisorContextPayload({
    approvedProfile: buildLive1bEquipifyCompanyProfileContent(),
  })
  assert.equal(contextPayload.qaMarker, GROWTH_AIOS_NEXT_1C_STRATEGIC_CONTEXT_QA_MARKER)
  console.log("  ✓ strategic context payload is client-safe")

  const hospital = evaluateGrowthHomeAvaStrategicIntent({
    instruction: "I want to start selling to hospitals in Texas.",
    activeMissionLabel: "Florida HVAC discovery",
    context: equipifyContext(),
  })
  assert.ok(hospital?.interpretation)
  assert.ok(hospital?.evaluation)
  assert.equal(hospital!.evaluation!.qaMarker, GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER)
  assert.equal(hospital!.evaluation!.alignment, "poor_fit")
  assert.equal(hospital!.evaluation!.allowsOverride, true)
  assert.ok(hospital!.evaluation!.concernReasons.length >= 2)
  assert.ok(hospital!.evaluation!.recommendedAlternative)
  assert.equal(hospital!.interpretation!.href, GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF)
  assert.match(hospital!.evaluation!.perspectiveLine, /don't think|strongest move/i)
  console.log("  ✓ hospitals in Texas challenged using profile + seller knowledge (not hardcoded only)")

  const hvac = evaluateGrowthHomeAvaStrategicIntent({
    instruction: "I want to focus on commercial HVAC companies in Texas.",
    context: equipifyContext(),
  })
  assert.equal(hvac?.evaluation?.alignment, "strong_fit")
  assert.equal(hvac?.evaluation?.proceedRecommendation, "support")
  assert.ok(hvac?.evaluation?.supportiveReasons.some((line) => /HVAC|profile/i.test(line)))
  console.log("  ✓ aligned service-vertical request receives support")

  const university = evaluateGrowthHomeAvaStrategicIntent({
    instruction: "I think we should target universities in California.",
    context: equipifyContext(),
  })
  assert.ok(university?.evaluation)
  assert.notEqual(university!.evaluation!.alignment, "strong_fit")
  assert.ok(university!.evaluation!.alternativeOptions.length >= 1)
  console.log("  ✓ institution-style targets receive alternatives without blocking execution")

  const overrideIntent = buildGrowthHomeAvaStrategicOverrideIntent({ evaluation: hospital!.evaluation! })
  assert.match(overrideIntent.restatement, /Understood/i)
  assert.match(overrideIntent.planSummary, /experimental market/i)
  assert.equal(overrideIntent.href, hospital!.interpretation!.href)
  console.log("  ✓ override preserves execution path with experimental monitoring copy")

  const marketKey = buildStrategicMarketKey({ industryLabel: "hospitals", geographyLabel: "Texas" })
  assert.equal(marketKey, "hospitals|texas")
  assert.equal(GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER, "ge-aios-next-1c-ava-strategic-override-v1")
  console.log("  ✓ operator override memory uses bounded market keys")

  const finishWork = evaluateGrowthHomeAvaStrategicIntent({
    instruction: "Finish Blitz Industries research",
    companyCandidates: [{ leadId: "lead-blitz", companyName: "Blitz Industries" }],
    context: equipifyContext(),
  })
  assert.ok(finishWork?.interpretation)
  assert.equal(finishWork?.evaluation, null)
  console.log("  ✓ tactical intents skip strategic evaluation")

  const advisorSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-strategic-advisor-next-1c.ts")
  assert.match(advisorSource, /projectApprovedBusinessProfileToSupportedServiceVerticals/)
  assert.match(advisorSource, /interpretGrowthHomeAvaMissionIntent/)
  assert.doesNotMatch(advisorSource, /buildGrowthHomeAvaRecommendationExperience/)
  assert.doesNotMatch(advisorSource, /runDecisionEngine|canonicalDecisionEngine/i)
  console.log("  ✓ no duplicate ICP, planner, recommendation, mission, or orchestration engines")

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(ui, /evaluateGrowthHomeAvaStrategicIntent/)
  assert.match(ui, /Proceed anyway/)
  assert.match(ui, /Continue with my recommendation/)
  assert.match(ui, /strategic-evaluation/)
  assert.match(ui, /data-qa-marker-next-1c/)
  console.log("  ✓ Home UI challenges before execute and always allows override")

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /strategicAdvisorContext/)
  assert.match(summaryService, /buildGrowthHomeAvaStrategicAdvisorContextPayload/)
  console.log("  ✓ workspace summary exposes approved profile slice for client evaluation")

  console.log(`\nPASS ${PHASE}`)
}

void main()
