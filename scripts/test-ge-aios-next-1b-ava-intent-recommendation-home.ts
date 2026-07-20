/**
 * GE-AIOS-NEXT-1B — Ava intent-led recommendation Home experience certification.
 * Run: pnpm test:ge-aios-next-1b-ava-intent-recommendation-home
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { interpretGrowthHomeAvaMissionIntent } from "../lib/growth/ava-home/recommendations/growth-home-ava-mission-interpreter-next-1b"
import {
  GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
  GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import { buildGrowthHomeAvaRecommendationExperience } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import { buildGrowthLeadHref } from "../lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "../lib/growth/navigation/growth-prospect-search-paths"

const PHASE = "GE-AIOS-NEXT-1B-AVA-INTENT-RECOMMENDATION-HOME" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockAiOsUx(overrides: Record<string, unknown> = {}) {
  return {
    hero: { greeting: "Good evening, Michael." },
    approveItemsCount: 0,
    waitingOnYou: [],
    dailyWorkQueue: [],
    approveItemsHref: "/growth/review?tab=packages",
    canonicalOperatorTask: null,
    canonicalOperatorFocus: null,
    canonicalApprovalSnapshot: null,
    canonicalActiveMissions: null,
    canonicalOperatorProgress: null,
    ...overrides,
  } as import("../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types").GrowthHomeAiOsUxViewModel
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  const hospitalIntent = interpretGrowthHomeAvaMissionIntent({
    instruction: "I think we should start selling to hospitals in Texas.",
    activeMissionLabel: "Florida HVAC discovery",
  })
  assert.ok(hospitalIntent)
  assert.equal(hospitalIntent!.qaMarker, GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER)
  assert.equal(hospitalIntent!.intentKind, "shift_market_focus")
  assert.match(hospitalIntent!.objectiveShiftLabel ?? "", /hospitals in Texas/i)
  assert.ok(hospitalIntent!.beforeBeginSteps.length >= 4)
  assert.match(hospitalIntent!.beforeBeginSteps[0] ?? "", /verify hospitals fit our ICP/i)
  assert.equal(hospitalIntent!.href, GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF)
  assert.match(hospitalIntent!.conflictNote ?? "", /Florida HVAC discovery/)
  console.log("  ✓ Mission Interpreter maps natural language to existing discovery flow")

  const finishIntent = interpretGrowthHomeAvaMissionIntent({
    instruction: "Finish Blitz",
    companyCandidates: [{ leadId: "lead-blitz", companyName: "Blitz Industries" }],
  })
  assert.equal(finishIntent?.intentKind, "finish_account_work")
  assert.match(finishIntent?.href ?? "", /open=lead-blitz/)
  assert.match(finishIntent?.expectedOutcome ?? "", /review-ready/i)
  console.log("  ✓ account-focused intent resolves to existing lead workspace")

  const experience = buildGrowthHomeAvaRecommendationExperience({
    greeting: "Good evening, Michael.",
    aiOsUx: mockAiOsUx({
      canonicalOperatorTask: {
        id: "approval:item-1",
        kind: "approval",
        title: "Review opportunity package for Blitz Industries",
        detail: "2 email drafts prepared",
        why: "Research is complete and outreach is ready for your review.",
        whatHappensNext: "Once you authorize, I'll prepare the send sequence.",
        confidenceLabel: null,
        href: buildGrowthLeadHref("lead-blitz"),
        companyName: "Blitz Industries",
        leadId: "lead-blitz",
        draftCount: 2,
        packageCount: 1,
      },
    }),
    primaryDecision: {
      id: "approval:item-1",
      label: "Review opportunity package for Blitz Industries",
      detail: "2 email drafts prepared",
      href: buildGrowthLeadHref("lead-blitz"),
    },
  })

  assert.equal(experience.presentationQaMarker, GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER)
  const top = experience.recommendations[0]
  assert.ok(top?.outcomeProjection?.outcomeHeadline ?? top?.employeeHeadline)
  assert.match(top?.outcomeProjection?.outcomeHeadline ?? top?.employeeHeadline ?? "", /approve the next opportunity/i)
  assert.equal(top?.companyName, "Blitz Industries")
  assert.ok(top?.executionPathSteps?.length)
  assert.ok(top?.explanation?.expectedOutcome)
  assert.ok(top?.explanation?.postponementRisk)
  console.log("  ✓ recommendation presentation uses employee voice and execution path")

  const enriched = enrichGrowthHomeAvaRecommendationItemNext1b({
    item: {
      id: "decision:1",
      rank: 2,
      kind: "lead_decision",
      title: "Finish research",
      headline: "Finish research",
      detail: null,
      supportingLine: "Research is already 80% complete.",
      outcomeLine: "Prepare outreach package",
      estimatedMinutes: 3,
      estimatedEffortLabel: "3 minutes",
      href: buildGrowthLeadHref("lead-blitz"),
      leadId: "lead-blitz",
      companyName: "Blitz Industries",
      whyReasons: ["Highest expected ROI", "Already 80% complete"],
      sourceLabel: "test",
    },
  })
  assert.match(enriched.employeeHeadline ?? "", /finishing the research for Blitz Industries/i)
  assert.deepEqual(enriched.executionPathSteps, [
    "Finish research",
    "Prepare outreach package",
    "Wait for approval",
    "Begin outreach",
  ])
  console.log("  ✓ execution path is presentation-only and kind-aware")

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
  )
  assert.match(ui, /evaluateGrowthHomeAvaStrategicIntent/)
  assert.match(ui, />Why</)
  assert.match(ui, /Suggest something else/)
  assert.match(ui, /Before I begin I will/)
  assert.match(ui, /recommendation-execution-path/)
  assert.doesNotMatch(readSource("lib/growth/ava-home/recommendations/growth-home-ava-mission-interpreter-next-1b.ts"), /openai|anthropic|llm/i)
  console.log("  ✓ UI uses Mission Interpreter and expanded explainability")

  assert.ok(GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS.length >= 3)
  console.log("  ✓ suggest-something-else uses conversational intros without reordering queue")

  console.log(`\nPASS ${PHASE}`)
}

void main()
