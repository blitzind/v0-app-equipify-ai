/**
 * GS-AI-PLAYBOOK-4A certification — buying stage & conversation state intelligence.
 */

import assert from "node:assert/strict"
import { buildGrowthBuyingStageContextFromSignals, buildGrowthBuyingStageOperatorPreview, buildGrowthConversationStateAssessment, buildGrowthBuyingStageAssessment, buildGrowthNextBestActionPlan, buildBuyingStageMessagingGuidance, GROWTH_BUYING_STAGE_QA_MARKER, applyBuyingStageGuidanceToRankedCtas } from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-context-builder"
import { resolveIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-registry"

const CERT_SECTION = process.env.GS_PLAYBOOK_4A_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function problemAwareSignals(): GrowthBuyingStageSignalInput {
  return {
    priorTouchCount: 1,
    priorReplyCount: 0,
    researchPainPoints: ["PM schedules disconnected from work orders"],
    relationshipStage: "aware",
    engagementTier: "warm",
    emailOpens: 1,
  }
}

function evaluatingHotSignals(): GrowthBuyingStageSignalInput {
  return {
    priorTouchCount: 4,
    priorReplyCount: 2,
    priorMeetingCount: 1,
    relationshipStage: "evaluating",
    engagementTier: "hot",
    opportunityStageKey: "qualified",
    emailOpens: 4,
    emailClicks: 2,
    calendarBookings: 1,
    memoryCommitteeSummaries: ["HTM director and compliance lead involved"],
  }
}

function runBuyingStageCert(): void {
  assert.equal(GROWTH_BUYING_STAGE_QA_MARKER, "growth-buying-stage-gs-ai-playbook-4a-v1")

  const unaware = buildGrowthBuyingStageAssessment({ priorTouchCount: 0 })
  assert.equal(unaware.stage, "unaware")
  assert.ok(unaware.confidenceScore >= 50)

  const problem = buildGrowthBuyingStageAssessment(problemAwareSignals())
  assert.equal(problem.stage, "problem_aware")

  const evaluating = buildGrowthBuyingStageAssessment(evaluatingHotSignals())
  assert.equal(evaluating.stage, "buying_committee")

  const dormant = buildGrowthBuyingStageAssessment({
    priorTouchCount: 3,
    daysSinceLastTouch: 45,
    relationshipStage: "inactive",
    engagementTier: "cold",
  })
  assert.equal(dormant.stage, "dormant")
  console.log("✓ buying stage — stage detection")
}

function runConversationStateCert(): void {
  const firstTouch = buildGrowthConversationStateAssessment({
    signals: { priorTouchCount: 0 },
    buyingStage: "unaware",
  })
  assert.equal(firstTouch.state, "first_touch")

  const replying = buildGrowthConversationStateAssessment({
    signals: { priorTouchCount: 2, priorReplyCount: 1, emailOpens: 2 },
    buyingStage: "solution_aware",
  })
  assert.equal(replying.state, "replying")

  const hot = buildGrowthConversationStateAssessment({
    signals: evaluatingHotSignals(),
    buyingStage: "evaluating",
  })
  assert.equal(hot.state, "hot")
  assert.ok(hot.meetings >= 1)
  console.log("✓ conversation state — transitions")
}

function runNextBestActionCert(): void {
  const guidance = buildBuyingStageMessagingGuidance({
    buyingStage: "problem_aware",
    conversationState: "engaged",
  })
  const plan = buildGrowthNextBestActionPlan({
    buyingStage: "problem_aware",
    conversationState: "engaged",
    messagingGuidance: guidance,
    signals: problemAwareSignals(),
    progressionTriggers: ["Diagnose workflow pain"],
    blockers: [],
  })
  assert.equal(plan.primaryAction, "ask_discovery_question")
  assert.ok(plan.avoidActions.some((entry) => /demo/i.test(entry)))

  const evalPlan = buildGrowthNextBestActionPlan({
    buyingStage: "evaluating",
    conversationState: "hot",
    messagingGuidance: buildBuyingStageMessagingGuidance({
      buyingStage: "evaluating",
      conversationState: "hot",
    }),
    signals: evaluatingHotSignals(),
    progressionTriggers: [],
    blockers: [],
  })
  assert.equal(evalPlan.primaryAction, "book_meeting")
  console.log("✓ next best action — action selection")
}

function runGuidanceCert(): void {
  const context = buildGrowthBuyingStageContextFromSignals(problemAwareSignals())
  assert.equal(context.buyingStage.stage, "problem_aware")
  assert.ok(context.messagingGuidance.avoidActions.some((entry) => /demo/i.test(entry)))

  const { playbook, resolution } = resolveIndustryPlaybook({
    industry: "biomedical equipment service",
    naics: ["621999"],
  })
  assert(playbook && resolution.industryId)
  const base = buildGrowthPlaybookContext({
    playbook: playbook!,
    industryId: resolution.industryId!,
    decisionMakerTitle: "HTM Director",
  })
  const boosted = applyBuyingStageGuidanceToRankedCtas(base.rankedCtas, context.messagingGuidance)
  assert.ok(boosted.rankedCtas.length >= 1)

  const industryContext = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["provides biomedical field service"],
    decisionMakerTitle: "HTM Director",
    buyerJourneySignals: problemAwareSignals(),
  })
  assert.ok(industryContext.buyerJourneyContext)
  assert.equal(industryContext.buyerJourneyContext!.buyingStage.stage, "problem_aware")
  assert.ok(industryContext.personaMessagingContext?.diagnostics.buyerJourneyDiagnostics)

  const preview = buildGrowthBuyingStageOperatorPreview(industryContext.buyerJourneyContext!.diagnostics)
  assert.match(preview.buyingStageLabel, /Problem Aware/i)
  assert.ok(preview.nextBestActions.length >= 1)

  const prompt = buildGrowthPlaybookOrchestratedPrompt({
    industryContext,
    narrativeContext: industryContext.narrativeContext,
    channel: "email",
  })
  assert.ok(prompt?.buyerJourneyDiagnostics)
  console.log("✓ buying stage guidance — ranking + diagnostics integration")
}

function runRegressionCert(): void {
  const without = buildGrowthIndustryContext({
    companyName: "Summit HVAC",
    industryLabel: "HVAC contractor",
    verifiedFacts: ["provides commercial HVAC maintenance"],
    decisionMakerTitle: "Operations Manager",
  })
  assert.equal(without.buyerJourneyContext, null)
  assert.ok(without.accountIntelligenceContext)
  assert.ok(without.outcomeGuidanceContext === null)

  const withStage = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["provides biomedical field service"],
    decisionMakerTitle: "HTM Director",
    buyerJourneySignals: evaluatingHotSignals(),
  })
  assert.ok(withStage.personaMessagingContext)
  assert.ok(withStage.buyerJourneyContext)
  console.log("✓ regression — 3A/3B/3C preserved, buyer journey optional")
}

const runners: Array<[string, () => void]> = [
  ["stage", runBuyingStageCert],
  ["conversation", runConversationStateCert],
  ["action", runNextBestActionCert],
  ["guidance", runGuidanceCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-4A buying stage certification passed.")
}
