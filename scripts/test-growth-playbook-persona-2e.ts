/**
 * GS-AI-PLAYBOOK-2E certification — buyer persona messaging frameworks.
 */

import assert from "node:assert/strict"
import { buildGrowthAiCopilotUserPrompt } from "@/lib/growth/ai-copilot-prompts"
import { buildOutreachRefinementUserPrompt } from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import {
  buildGrowthPlaybookOrchestratedPrompt,
  buildGrowthPlaybookOrchestratedPromptBlock,
} from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import {
  buildPersonaFrameworkFromArchetype,
  resolvePersonaArchetype,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-frameworks"
import { buildPersonaLanguageBlock } from "@/lib/growth/playbooks/personas/growth-playbook-persona-language"
import {
  buildGrowthPersonaMessagingContext,
  GROWTH_PLAYBOOK_PERSONA_MESSAGING_QA_MARKER,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-messaging"
import { buildPersonalizationUserPrompt } from "@/lib/growth/personalization/personalization-prompt"
import type { GrowthPersonalizationContext } from "@/lib/growth/personalization/personalization-types"

const CERT_SECTION = process.env.GS_PLAYBOOK_2E_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
]

function buildSterlingContext(signals?: {
  decisionMakerTitle?: string
  verifiedFacts?: string[]
}) {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Field service and biomedical support provider",
    naics: ["621999"],
    verifiedFacts: signals?.verifiedFacts ?? sterlingVerified,
    researchSignals: ["PM compliance tracking for patient-connected devices"],
    decisionMakerTitle: signals?.decisionMakerTitle ?? "Compliance Manager",
  })
}

function runFrameworkCert(): void {
  assert.equal(GROWTH_PLAYBOOK_PERSONA_MESSAGING_QA_MARKER, "growth-playbook-persona-messaging-gs-ai-playbook-2e-v1")
  const resolved = resolvePersonaArchetype("HTM Director", "HTM Director")
  assert.equal(resolved.archetype, "htm_director")
  assert.equal(resolved.confidence, "high")

  const ownerResolved = resolvePersonaArchetype("Owner", "Owner")
  assert.equal(ownerResolved.archetype, "owner")
  const ownerFramework = buildPersonaFrameworkFromArchetype(
    { title: "Owner", goals: [], kpis: [], frustrations: [], buyingTriggers: [], commonObjections: [], successMetrics: [] },
    "owner",
  )
  assert.ok(ownerFramework.priorities.includes("profitability"))
  assert.ok(ownerFramework.preferredProofTypes.includes("revenue_growth"))
  assert.ok(ownerFramework.preferredCtaTypes.includes("roi_discussion"))
  console.log("✓ persona frameworks — archetype resolution + static model")
}

function runLanguageCert(): void {
  const context = buildSterlingContext({ decisionMakerTitle: "HTM Director" })
  const persona = context.personaMessagingContext!
  assert.equal(persona.framework.languageStyle, "technical")
  assert.ok(persona.recommendedLanguageBlock.toLowerCase().includes("compliance"))

  const ownerContext = buildSterlingContext({ decisionMakerTitle: "Owner" })
  const ownerPersona = ownerContext.personaMessagingContext!
  assert.equal(ownerPersona.framework.languageStyle, "executive")
  assert.ok(buildPersonaLanguageBlock(ownerPersona.framework).toLowerCase().includes("executive"))
  console.log("✓ language profiles — HTM technical, owner executive")
}

function runProofAndCtaCert(): void {
  const serviceFramework = buildPersonaFrameworkFromArchetype(
    {
      title: "Service Manager",
      goals: [],
      kpis: [],
      frustrations: [],
      buyingTriggers: [],
      commonObjections: [],
      successMetrics: [],
    },
    "service_manager",
  )
  assert.ok(serviceFramework.preferredProofTypes.includes("technician_productivity"))
  assert.ok(serviceFramework.preferredCtaTypes.includes("dispatch_demonstration"))

  const dispatcherFramework = buildPersonaFrameworkFromArchetype(
    {
      title: "Dispatcher",
      goals: [],
      kpis: [],
      frustrations: [],
      buyingTriggers: [],
      commonObjections: [],
      successMetrics: [],
    },
    "dispatcher",
  )
  assert.ok(dispatcherFramework.preferredCtaTypes.includes("scheduling_walkthrough"))
  assert.ok(dispatcherFramework.preferredProofTypes.includes("faster_scheduling"))
  console.log("✓ proof + CTA selection — service manager + dispatcher")
}

function runMessagingContextCert(): void {
  const context = buildSterlingContext()
  assert(context.personaMessagingContext)
  const built = buildGrowthPersonaMessagingContext({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    decisionMakerTitle: "Compliance Manager",
  })
  assert(built)
  assert.equal(built!.diagnostics.frameworkApplied, true)
  assert.ok(built!.diagnostics.topicsAvoided.length >= 2)
  assert.ok(built!.personaFrameworkBlock.includes("Priorities:"))
  console.log("✓ persona messaging context — diagnostics + framework block")
}

function runPromptOrchestrationCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
  })!
  assert(orchestrated.personaDiagnostics)
  assert(orchestrated.formattedBlock.includes("=== Buyer Persona Framework ==="))
  assert(orchestrated.formattedBlock.includes("=== Recommended Language ==="))
  assert(orchestrated.formattedBlock.includes("=== Preferred Proof ==="))
  assert(orchestrated.formattedBlock.includes("=== Preferred CTA ==="))
  assert(orchestrated.formattedBlock.includes("=== Topics To Avoid ==="))
  assert(orchestrated.formattedBlock.includes("=== Context Weighting ==="))
  console.log("✓ prompt orchestration — persona-first sections in email prompt")
}

function runEmailCert(): void {
  const context = buildSterlingContext({ decisionMakerTitle: "Operations Director" })
  const prompt = buildPersonalizationUserPrompt({
    context: {
      companyName: "Sterling Biomedical",
      industryLabel: "biomedical equipment service",
      companySignals: sterlingVerified,
      websiteSignals: [],
      researchPainPoints: [],
      buyingSignals: [],
      opportunitySignals: [],
      hiringSignals: [],
    } satisfies GrowthPersonalizationContext,
    evidence: [],
    industryContext: context,
  })
  assert.match(prompt, /Buyer Persona Framework/)
  assert.match(prompt, /Preferred Proof/)
  assert(context.personaMessagingContext!.diagnostics.frameworkApplied)
  console.log("✓ email — full persona framework in Stack A prompt")
}

function runSmsCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "sms",
  })!
  assert(orchestrated.formattedBlock.includes("=== Recommended Language ==="))
  assert(orchestrated.formattedBlock.includes("=== Preferred CTA ==="))
  const hasTopics = orchestrated.formattedBlock.includes("=== Topics To Avoid ===")
  const topicsTrimmed = orchestrated.promptOptimization?.sectionsTrimmed.includes("topics_to_avoid")
  assert(hasTopics || topicsTrimmed)
  assert.ok(!orchestrated.formattedBlock.includes("=== Industry Intelligence"))
  console.log("✓ SMS — persona language, CTA, avoid topics only")
}

function runVoiceCert(): void {
  const context = buildSterlingContext({ decisionMakerTitle: "Owner" })
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "voice",
  })!
  assert(orchestrated.formattedBlock.includes("=== Buyer Persona Framework ==="))
  assert(orchestrated.formattedBlock.includes("Opening:"))
  assert(orchestrated.formattedBlock.includes("=== Preferred Proof ==="))
  console.log("✓ voice — tone, opening, proof, CTA")
}

function runSendrCert(): void {
  const context = buildSterlingContext()
  const block = buildIndustryContextPromptBlock(context, "page")
  assert.match(block, /Buyer Persona Framework/)
  assert.match(block, /Preferred Proof/)
  console.log("✓ Sendr/share page — persona messaging blocks")
}

function runShareCert(): void {
  const context = buildSterlingContext({ decisionMakerTitle: "Service Manager" })
  const block = buildGrowthPlaybookOrchestratedPromptBlock({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "page",
  })
  assert.match(block, /Messaging blocks:/)
  assert.match(block, /Preferred CTA/)
  console.log("✓ share page — persona blocks + proof + CTA")
}

function runCopilotCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "copilot",
  })!
  assert.match(orchestrated.buyerPersonaFramework, /Diagnostics: archetype=/)
  const prompt = buildGrowthAiCopilotUserPrompt("cold_email", {
    companyName: "Sterling Biomedical",
    contactName: "Alex",
    fitScore: 80,
    engagementTier: "warm",
    engagementSummary: "Opened email",
    relationshipTier: "new",
    relationshipTrend: "neutral",
    opportunityTier: "medium",
    opportunityBlockers: [],
    opportunityAccelerators: [],
    revenueTier: "medium",
    revenueTrajectory: "stable",
    executiveTier: "standard",
    executiveRecommendation: "continue",
    capacityTier: "available",
    capacityProtection: "none",
    researchSummary: "Biomedical service",
    researchNextAction: "Outreach",
    decisionMakers: [],
    nextBestAction: "email",
    nextBestActionReason: "fit",
    recentOutbound: [],
    replyPreview: null,
    frameworks: { objections: [], buyingSignals: [], commitmentSignals: [] },
    relationshipMemory: null,
  }, { industryContext: context, narrativeContext: context.narrativeContext })
  const parsed = JSON.parse(prompt) as { personaDiagnostics?: { frameworkApplied?: boolean } }
  assert.equal(parsed.personaDiagnostics?.frameworkApplied, true)
  console.log("✓ copilot — persona framework diagnostics exposed")
}

function runRefinementCert(): void {
  const context = buildSterlingContext()
  const prompt = buildOutreachRefinementUserPrompt({
    draft: { subject: "Test", body: "Draft body", wordCount: 10 },
    blocks: [],
    allowedFacts: sterlingVerified,
    industryContext: context,
    maxWords: 120,
  })
  const parsed = JSON.parse(prompt) as {
    narrativeOrchestration?: { personaDiagnostics?: { persona?: string }; buyerPersonaFramework?: string }
  }
  assert(parsed.narrativeOrchestration?.personaDiagnostics?.persona)
  assert(parsed.narrativeOrchestration?.buyerPersonaFramework?.includes("Priorities:"))
  console.log("✓ refinement — persona diagnostics in narrative orchestration JSON")
}

function runRegressionCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
  })!
  assert(orchestrated.promptOptimization!.weightingPreserved)
  assert(orchestrated.formattedBlock.includes("=== Verified Company Facts ==="))
  assert(orchestrated.formattedBlock.includes("=== Narrative Direction ==="))
  assert(orchestrated.avoid.some((entry) => /unverified/i.test(entry)))

  const sms = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "sms",
  })!
  assert.ok(sms.promptOptimization!.estimatedPromptSize <= sms.promptOptimization!.budgetLimit)
  console.log("✓ regression — 2C/2D weighting + SMS budget preserved")
}

const runners: Array<[string, () => void]> = [
  ["frameworks", runFrameworkCert],
  ["language", runLanguageCert],
  ["proof", runProofAndCtaCert],
  ["messaging", runMessagingContextCert],
  ["prompts", runPromptOrchestrationCert],
  ["email", runEmailCert],
  ["sms", runSmsCert],
  ["voice", runVoiceCert],
  ["sendr", runSendrCert],
  ["share", runShareCert],
  ["copilot", runCopilotCert],
  ["refinement", runRefinementCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-2E persona messaging certification passed.")
}
