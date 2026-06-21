/**
 * GS-AI-PLAYBOOK-4B certification — multi-step reasoning & message planning engine.
 */

import assert from "node:assert/strict"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildGrowthReasoningObservations } from "@/lib/growth/reasoning/growth-observation-builder"
import { buildGrowthNarrativeBrief } from "@/lib/growth/reasoning/growth-message-brief"
import { buildGrowthMessagePlan } from "@/lib/growth/reasoning/growth-message-planner"
import {
  buildGrowthReasoningContext,
  buildMinimalOutreachContextPacketForReasoning,
  GROWTH_REASONING_QA_MARKER,
} from "@/lib/growth/reasoning/growth-reasoning-engine"
import { prioritizeGrowthReasoningObservations } from "@/lib/growth/reasoning/growth-priority-engine"
import { GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS } from "@/lib/growth/reasoning/growth-reasoning-types"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"

const CERT_SECTION = process.env.GS_PLAYBOOK_4B_CERT_SECTION ?? "all"

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
    emailOpens: 2,
  }
}

function sterlingIndustryContext() {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    decisionMakerTitle: "HTM Director",
    buyerJourneySignals: problemAwareSignals(),
  })
}

function sterlingPacket() {
  return buildMinimalOutreachContextPacketForReasoning({
    industryContext: sterlingIndustryContext(),
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    verifiedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    researchPainPoints: ["PM schedules disconnected from work orders"],
    priorTouchCount: 1,
    engagementScore: 55,
  })
}

function runObservationCert(): void {
  assert.equal(GROWTH_REASONING_QA_MARKER, "growth-reasoning-gs-ai-playbook-4b-v1")

  const observations = buildGrowthReasoningObservations({ packet: sterlingPacket(), channel: "EMAIL" })
  assert.ok(observations.length >= 5)
  assert.ok(observations.some((entry) => entry.category === "verified_company"))
  assert.ok(observations.some((entry) => entry.category === "buyer_journey"))
  assert.ok(observations.some((entry) => /hospital/i.test(entry.statement)))
  assert.ok(observations.every((entry) => entry.confidence >= 0 && entry.confidence <= 100))
  console.log("✓ observation builder — categories and confidence")
}

function runPriorityCert(): void {
  const observations = buildGrowthReasoningObservations({ packet: sterlingPacket(), channel: "EMAIL" })
  const email = prioritizeGrowthReasoningObservations({
    observations,
    channel: "EMAIL",
    buyingStage: "problem_aware",
  })
  assert.equal(email.topInsights.length, GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS.EMAIL)
  assert.ok(email.secondaryInsights.length >= 1)

  const sms = prioritizeGrowthReasoningObservations({
    observations,
    channel: "SMS",
    buyingStage: "problem_aware",
  })
  assert.equal(sms.topInsights.length, GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS.SMS)

  const repeat = prioritizeGrowthReasoningObservations({
    observations,
    channel: "EMAIL",
    buyingStage: "problem_aware",
  })
  assert.deepEqual(
    email.topInsights.map((entry) => entry.statement),
    repeat.topInsights.map((entry) => entry.statement),
  )
  console.log("✓ priority engine — limits and determinism")
}

function runPlannerCert(): void {
  const context = buildGrowthReasoningContext({ packet: sterlingPacket(), channel: "EMAIL" })
  const plan = context.diagnostics.messagePlan
  assert.ok(plan.openingStrategy.length > 10)
  assert.ok(plan.credibilityStrategy.length > 10)
  assert.ok(plan.valueStrategy.length > 10)
  assert.ok(plan.ctaStrategy.length > 5)
  assert.ok(plan.avoidTopics.length >= 1)
  assert.ok(plan.narrativeOrder.length >= 3)

  const direct = buildGrowthMessagePlan({
    topInsights: context.diagnostics.topInsights,
    industryContext: sterlingIndustryContext(),
  })
  assert.equal(direct.openingStrategy, plan.openingStrategy)
  console.log("✓ message planner — deterministic plan")
}

function runBriefCert(): void {
  const context = buildGrowthReasoningContext({ packet: sterlingPacket(), channel: "EMAIL" })
  const brief = context.diagnostics.narrativeBrief
  assert.match(brief.audience, /Sterling Biomedical/)
  assert.match(brief.stage, /Problem Aware/i)
  assert.match(brief.persona, /HTM Director/i)
  assert.ok(brief.primaryProblems.length >= 1)
  assert.ok(brief.valueThemes.length >= 1)
  assert.ok(brief.objective.length > 10)

  const preview = formatGrowthReasoningOperatorPreview(context.diagnostics)
  assert.ok(preview.topInsights.length >= 1)
  assert.ok(preview.recommendedApproach.length >= 2)
  assert.ok(preview.objective.length > 10)

  const direct = buildGrowthNarrativeBrief({
    topInsights: context.diagnostics.topInsights,
    messagePlan: context.diagnostics.messagePlan,
    industryContext: sterlingIndustryContext(),
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
  })
  assert.equal(direct.objective, brief.objective)
  console.log("✓ narrative brief — operator preview")
}

function runRegressionCert(): void {
  const industryContext = sterlingIndustryContext()
  assert.ok(industryContext.buyerJourneyContext)
  assert.ok(industryContext.accountIntelligenceContext)
  assert.equal(industryContext.reasoningContext, undefined)

  const context = buildGrowthReasoningContext({ packet: sterlingPacket(), channel: "EMAIL" })
  assert.ok(context.diagnostics.observations.length >= 5)
  assert.equal(context.diagnostics.topInsights.length, 5)

  const prompt = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: {
      ...industryContext,
      reasoningContext: context,
    },
    narrativeContext: industryContext.narrativeContext,
    channel: "email",
    skipOptimization: true,
  })
  assert.ok(prompt?.reasoningDiagnostics)
  assert.match(prompt?.formattedBlock ?? "", /NARRATIVE BRIEF/i)
  console.log("✓ regression — 4A/3C preserved, reasoning additive")
}

const runners: Array<[string, () => void]> = [
  ["observations", runObservationCert],
  ["priority", runPriorityCert],
  ["planner", runPlannerCert],
  ["brief", runBriefCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-4B reasoning certification passed.")
}
