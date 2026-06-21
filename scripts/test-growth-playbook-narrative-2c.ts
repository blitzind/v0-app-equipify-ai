/**
 * GS-AI-PLAYBOOK-2C certification — narrative intelligence & prompt orchestration.
 */

import assert from "node:assert/strict"
import { generateApolloVoiceDropScriptFromIndustryContext } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"
import { buildGrowthAiCopilotUserPrompt } from "@/lib/growth/ai-copilot-prompts"
import { buildOutreachRefinementUserPrompt } from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import { applyPlaybookIndustryBlocksToStrategy } from "@/lib/growth/outreach/personalization/outreach-industry-playbook-blocks"
import { assembleDeterministicOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import type { OutreachContextPacket, SelectedMessageBlock } from "@/lib/growth/outreach/personalization/personalization-types"
import {
  buildGrowthIndustryContext,
  buildGrowthNarrativeContext,
  buildIndustryContextSmsDraft,
} from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import { GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-builder"
import {
  buildGrowthPlaybookOrchestratedPrompt,
  buildGrowthPlaybookOrchestratedPromptBlock,
} from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildPersonalizationUserPrompt } from "@/lib/growth/personalization/personalization-prompt"
import type { GrowthPersonalizationContext } from "@/lib/growth/personalization/personalization-types"

const CERT_SECTION = process.env.GS_PLAYBOOK_2C_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
]

function buildSterlingContext(signals?: {
  researchSignals?: string[]
  hiringSignals?: string[]
  decisionMakerTitle?: string
  verifiedFacts?: string[]
}) {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Field service and biomedical support provider",
    naics: ["621999"],
    verifiedFacts: signals?.verifiedFacts ?? sterlingVerified,
    researchSignals: signals?.researchSignals ?? ["PM compliance tracking for patient-connected devices"],
    hiringSignals: signals?.hiringSignals ?? [],
    decisionMakerTitle: signals?.decisionMakerTitle ?? "Compliance Manager",
  })
}

function runNarrativeBuilderCert(): void {
  assert.equal(GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER, "growth-playbook-narrative-gs-ai-playbook-2c-v1")
  const context = buildSterlingContext({ researchSignals: ["FDA recall documentation and audit readiness"] })
  const narrative = context.narrativeContext
  assert(narrative, "narrativeContext expected")
  assert.equal(narrative!.narrativeType, "compliance")
  assert.equal(narrative!.leadWith, "compliance")
  assert(narrative!.recommendedOpening.includes("regulated equipment"))
  assert(narrative!.primaryNarrative.length > 20)
  assert(narrative!.objectionAwareness.length <= 3)
  console.log("✓ narrative builder — compliance narrative selected")
}

function runOrchestrationCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
  })
  assert(orchestrated)
  assert(orchestrated!.formattedBlock.includes("=== Verified Company Facts ==="))
  assert(orchestrated!.formattedBlock.includes("=== Narrative Direction ==="))
  assert(orchestrated!.formattedBlock.includes("=== Context Weighting ==="))
  assert(orchestrated!.weightingInstructions.includes("%"))
  assert(orchestrated!.emphasize.length >= 2)
  assert(orchestrated!.avoid.some((entry) => /unverified/i.test(entry)))
  console.log("✓ prompt orchestration — structured sections + weighting")
}

function runPersonaToneCert(): void {
  const context = buildSterlingContext({ decisionMakerTitle: "Compliance Manager" })
  const narrative = context.narrativeContext!
  assert.equal(narrative.recommendedTone, "technical")
  assert(narrative.buyerPersona)

  const executiveContext = buildSterlingContext({ decisionMakerTitle: "Owner" })
  assert.equal(executiveContext.narrativeContext!.recommendedTone, "executive")
  console.log("✓ persona + tone — compliance technical, owner executive")
}

function runWeightingCert(): void {
  const sparse = buildSterlingContext({ verifiedFacts: [] })
  assert.equal(sparse.narrativeContext!.companyVsIndustryRatio.companyPercent, 20)
  assert.equal(sparse.narrativeContext!.companyVsIndustryRatio.industryPercent, 80)

  const rich = buildSterlingContext({
    verifiedFacts: ["fact one", "fact two", "fact three"],
  })
  assert.equal(rich.narrativeContext!.companyVsIndustryRatio.companyPercent, 70)
  console.log("✓ weighting — sparse 20/80, rich 70/30")
}

function runOutreachPromptsV3Cert(): void {
  const context = buildSterlingContext()
  const prompt = buildOutreachRefinementUserPrompt({
    draft: { subject: "Test", body: "Draft body", wordCount: 10 },
    blocks: [],
    allowedFacts: sterlingVerified,
    industryContext: context,
    maxWords: 120,
  })
  const parsed = JSON.parse(prompt) as { narrativeOrchestration?: { formattedBlock?: string } }
  assert(parsed.narrativeOrchestration?.formattedBlock?.includes("Narrative Direction"))
  console.log("✓ outreach prompts v3 — narrative orchestration in refinement JSON")
}

function runSendrPromptsCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context, "page")
  assert(prompt.includes("Industry playbook:"))
  assert(prompt.includes("=== Buyer Persona ==="))
  assert(prompt.includes("Narrative Direction"))
  console.log("✓ Sendr prompts — orchestrated page block")
}

function runSharePromptsCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context, "page")
  assert(prompt.includes("Verified Company Facts"))
  assert(prompt.includes("CTA Guidance"))
  console.log("✓ Share prompts — orchestrated page block")
}

function runRegressionCert(): void {
  const context = buildSterlingContext()
  assert(buildGrowthNarrativeContext({ industryContext: context }))
  const sms = buildIndustryContextSmsDraft(context)
  assert(sms)
  const voice = generateApolloVoiceDropScriptFromIndustryContext({
    script_type: "biomedical_specific",
    full_name: "Jordan Lee",
    company_name: "Sterling Biomedical",
    industryContext: context,
  })
  assert(voice.full_script.length > 40)

  const personalizationContext: GrowthPersonalizationContext = {
    leadLabel: "Sterling Biomedical",
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    relationshipStage: null,
    relationshipSummary: null,
    topObjections: [],
    topPreferences: [],
    opportunitySignals: [],
    bookingSignals: [],
    engagementTier: null,
    territoryLabel: null,
    websiteSignals: [],
    committeeContext: [],
    buyingSignals: [],
    companySignals: sterlingVerified,
    inboxHistory: [],
    sequenceHistory: [],
    templateOverlay: null,
    sourcesUsed: [],
    companySummary: null,
    outreachAngles: [],
    researchPainPoints: ["PM compliance"],
    hiringSignals: [],
    researchConfidence: null,
    companyDescription: null,
    naicsCodes: ["621999"],
    sicCodes: [],
  }
  const stackAPrompt = buildPersonalizationUserPrompt({
    context: personalizationContext,
    evidence: [],
    industryContext: context,
  })
  assert(stackAPrompt.includes("Narrative Direction"))

  const copilotPrompt = buildGrowthAiCopilotUserPrompt("call_opening", {
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    fitScore: 70,
    engagementTier: null,
    engagementSummary: null,
    relationshipTier: null,
    relationshipTrend: null,
    opportunityTier: null,
    opportunityBlockers: [],
    opportunityAccelerators: [],
    revenueTier: null,
    revenueTrajectory: null,
    executiveTier: null,
    executiveRecommendation: null,
    capacityTier: null,
    capacityProtection: null,
    researchSummary: null,
    researchNextAction: null,
    decisionMakers: [],
    nextBestAction: null,
    nextBestActionReason: null,
    recentOutbound: [],
    replyPreview: null,
    growthSignalScore: null,
    growthSignalTier: null,
    growthSignalRecommendedAction: null,
    topGrowthSignals: [],
    relationshipMemory: { available: false },
    frameworks: { objections: [], buyingSignals: [], commitmentSignals: [] },
  }, { industryContext: context, narrativeContext: context.narrativeContext })
  assert(copilotPrompt.includes("narrativeOrchestration"))

  const packet: OutreachContextPacket = {
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    website: null,
    employeeSize: null,
    location: null,
    decisionMakerName: "Jordan Lee",
    decisionMakerTitle: "Compliance Manager",
    fitScore: 72,
    engagementScore: null,
    opportunityReadinessTier: null,
    buyingIntent: null,
    competitorPressure: null,
    capacitySignals: [],
    websiteSummary: null,
    websiteTextExcerpt: null,
    websiteFindings: [],
    hiringSignals: [],
    enrichmentFindings: [],
    researchRecommendedNextAction: null,
    priorTouchSummaries: [],
    priorReplySummaries: [],
    objectionSummaries: [],
    sequenceHistorySummaries: [],
    timelineEventSummaries: [],
    researchConfidence: null,
    researchPainPoints: [],
    equipmentServiceIndicators: sterlingVerified,
    companySummary: null,
    outreachAngles: [],
    priorOutboundSubjects: [],
    priorTouchCount: 0,
    hasWebsiteResearch: false,
    hasDecisionMaker: true,
    memoryAvailable: false,
    memoryCoverageScore: null,
    relationshipStage: null,
    relationshipSummary: null,
    memoryPreferenceSummaries: [],
    memoryInteractionSummaries: [],
    memoryCommitmentSummaries: [],
    memoryAvoidRepeating: [],
    memoryRiskFlags: [],
    memoryCommitteeSummaries: [],
    memoryOpenLoopSummaries: [],
    memoryEngagementTrend: null,
    memoryProgressionScore: null,
    memoryUnresolvedObjectionCount: 0,
    leadEngineGuidance: null,
    industryContext: context,
  }
  const blocks: SelectedMessageBlock[] = [
    { key: "opening", blockId: "opening_direct", label: "Direct", text: "Hi there." },
    { key: "pain", blockId: "pain_old", label: "Pain", text: "Generic." },
    { key: "industry", blockId: "industry_old", label: "Industry", text: "Generic." },
    { key: "proof", blockId: "proof_old", label: "Proof", text: "Generic." },
    { key: "cta", blockId: "cta_old", label: "CTA", text: "Quick call?" },
  ]
  const applied = applyPlaybookIndustryBlocksToStrategy({ blocks, context, packet, usedMemoryOpener: false, usedResearchOpener: false })
  const draft = assembleDeterministicOutreachDraft({ strategy: { blocks: applied } as never, subject: "Sterling", maxWords: 120 })
  assert(/often/i.test(draft.body))
  console.log("✓ regression — Stack A/B, voice, SMS, copilot, email draft")
}

function main(): void {
  if (section("narrative")) runNarrativeBuilderCert()
  if (section("orchestration")) runOrchestrationCert()
  if (section("persona")) runPersonaToneCert()
  if (section("weighting")) runWeightingCert()
  if (section("outreach")) runOutreachPromptsV3Cert()
  if (section("sendr")) runSendrPromptsCert()
  if (section("share")) runSharePromptsCert()
  if (section("regression")) runRegressionCert()

  console.log("\nGS-AI-PLAYBOOK-2C certification passed")
  console.log("QA:", GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER)
}

main()
