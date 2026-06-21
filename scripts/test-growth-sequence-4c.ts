/**
 * GS-AI-PLAYBOOK-4C certification — multi-touch sequence intelligence.
 */

import assert from "node:assert/strict"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildGrowthReasoningContext } from "@/lib/growth/reasoning/growth-reasoning-engine"
import {
  buildGrowthSequenceIntelligenceContext,
  GROWTH_SEQUENCE_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import { buildMinimalOutreachContextPacketForReasoning } from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthSequenceNarrativeProgression } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { buildGrowthSequenceProofProgression } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { buildGrowthSequenceCtaProgression } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { buildGrowthSequenceEngagementProgression } from "@/lib/growth/sequence-intelligence/growth-engagement-progression"
import { buildGrowthSequenceFatigue } from "@/lib/growth/sequence-intelligence/growth-sequence-fatigue"
import { buildGrowthSequenceGuidance } from "@/lib/growth/sequence-intelligence/growth-sequence-guidance"
import { detectGrowthSequenceState } from "@/lib/growth/sequence-intelligence/growth-sequence-state"
import { formatGrowthSequenceOperatorPreview } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import type { GrowthSequenceSignalInput } from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"

const CERT_SECTION = process.env.GS_PLAYBOOK_4C_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function touchFourSignals(): GrowthSequenceSignalInput {
  return {
    priorTouchCount: 4,
    priorOutboundSubjects: [
      "PM workflow gaps at Sterling Biomedical",
      "Dispatch scheduling for hospital teams",
      "Operational proof for HTM workflows",
      "Book a demo for Sterling Biomedical",
    ],
    priorTouchSummaries: [
      "Intro on industry pain for hospital biomedical teams",
      "Workflow challenges across PM schedules",
      "Operational proof on technician productivity",
      "Meeting ask for demo",
    ],
    sequenceHistorySummaries: [
      "Sequence step 1: industry pain",
      "Sequence step 2: workflow pain",
      "Sequence step 3: operational proof",
      "Sequence step 4: book a demo",
    ],
    emailOpens: 3,
    emailClicks: 1,
    daysSinceLastTouch: 6,
    buyingStage: "problem_aware",
    conversationState: "engaged",
  }
}

function sterlingPacket() {
  const industryContext = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    decisionMakerTitle: "HTM Director",
  })
  return buildMinimalOutreachContextPacketForReasoning({
    industryContext,
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    priorTouchCount: 4,
    engagementScore: 58,
  })
}

function runSequenceStateCert(): void {
  assert.equal(GROWTH_SEQUENCE_INTELLIGENCE_QA_MARKER, "growth-sequence-intelligence-gs-ai-playbook-4c-v1")
  assert.equal(detectGrowthSequenceState({ priorTouchCount: 0 }), "first_touch")
  assert.equal(detectGrowthSequenceState(touchFourSignals()), "engaged_sequence")
  assert.equal(
    detectGrowthSequenceState({
      priorTouchCount: 6,
      priorReplySummaries: [],
      daysSinceLastTouch: 20,
    }),
    "exhausted_sequence",
  )
  console.log("✓ sequence state — detection")
}

function runNarrativeProgressionCert(): void {
  const progression = buildGrowthSequenceNarrativeProgression(touchFourSignals())
  assert.ok(progression.usedThemes.includes("workflow_pain"))
  assert.ok(progression.recommendedThemes.length >= 1)
  assert.ok(!progression.recommendedThemes.includes("workflow_pain") || progression.overusedThemes.includes("workflow_pain"))
  console.log("✓ narrative progression — theme tracking")
}

function runProofProgressionCert(): void {
  const progression = buildGrowthSequenceProofProgression(touchFourSignals())
  assert.ok(progression.usedProofStages.length >= 1)
  assert.ok(progression.recommendedProof)
  console.log("✓ proof progression — stage rotation")
}

function runCtaProgressionCert(): void {
  const progression = buildGrowthSequenceCtaProgression(touchFourSignals())
  assert.ok(progression.avoidCtas.some((entry) => /demo/i.test(entry)))
  assert.match(progression.recommendedCta, /case study|meeting|workflow|question|implement/i)
  console.log("✓ cta progression — avoid repeat demo")
}

function runEngagementProgressionCert(): void {
  const hot = buildGrowthSequenceEngagementProgression({
    ...touchFourSignals(),
    priorReplySummaries: ["Thanks, send more info"],
    emailOpens: 4,
    emailClicks: 2,
  })
  assert.equal(hot.engagementTrend, "interestIncreasing")

  const cold = buildGrowthSequenceEngagementProgression({
    priorTouchCount: 4,
    daysSinceLastTouch: 40,
    emailOpens: 0,
  })
  assert.equal(cold.engagementTrend, "interestDecreasing")
  console.log("✓ engagement progression — trend detection")
}

function runFatigueCert(): void {
  const fatigue = buildGrowthSequenceFatigue(touchFourSignals())
  assert.ok(["low", "medium", "high"].includes(fatigue.fatigueLevel))
  assert.ok(fatigue.reasons.length >= 1)
  assert.ok(fatigue.recommendations.length >= 1)
  console.log("✓ sequence fatigue — detection")
}

function runGuidanceCert(): void {
  const guidance = buildGrowthSequenceGuidance(touchFourSignals())
  assert.ok(guidance.nextNarrative)
  assert.ok(guidance.nextProof)
  assert.ok(guidance.nextCta)
  assert.ok(guidance.avoidPatterns.length >= 1)
  assert.ok(guidance.confidence >= 40)

  const context = buildGrowthSequenceIntelligenceContext({ packet: sterlingPacket() })
  const preview = formatGrowthSequenceOperatorPreview(context.diagnostics)
  assert.equal(preview.touchCount, 4)
  assert.ok(preview.recommended.length >= 2)
  console.log("✓ sequence guidance — operator preview")
}

function runRegressionCert(): void {
  const packet = sterlingPacket()
  packet.priorTouchSummaries = touchFourSignals().priorTouchSummaries ?? []
  packet.priorOutboundSubjects = touchFourSignals().priorOutboundSubjects ?? []
  packet.sequenceHistorySummaries = touchFourSignals().sequenceHistorySummaries ?? []
  packet.priorTouchCount = 4

  const sequence = buildGrowthSequenceIntelligenceContext({ packet })
  const reasoning = buildGrowthReasoningContext({ packet, channel: "EMAIL" })
  assert.ok(reasoning.diagnostics.sequenceDiagnostics)
  assert.ok(sequence.diagnostics.guidanceApplied)

  const prompt = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: {
      ...(packet.industryContext ?? buildGrowthIndustryContext({ companyName: "Sterling Biomedical" })),
      sequenceIntelligenceContext: sequence,
      reasoningContext: { channel: "EMAIL", diagnostics: reasoning.diagnostics },
    },
    narrativeContext: packet.industryContext?.narrativeContext ?? null,
    channel: "email",
    skipOptimization: true,
  })
  assert.ok(prompt?.sequenceDiagnostics)
  assert.match(prompt?.formattedBlock ?? "", /SEQUENCE GUIDANCE/i)
  console.log("✓ regression — 4B preserved, sequence additive")
}

const runners: Array<[string, () => void]> = [
  ["state", runSequenceStateCert],
  ["narrative", runNarrativeProgressionCert],
  ["proof", runProofProgressionCert],
  ["cta", runCtaProgressionCert],
  ["engagement", runEngagementProgressionCert],
  ["fatigue", runFatigueCert],
  ["guidance", runGuidanceCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-4C sequence intelligence certification passed.")
}
