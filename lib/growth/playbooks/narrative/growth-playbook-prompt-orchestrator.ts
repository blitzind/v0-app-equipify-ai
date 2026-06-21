/** GS-AI-PLAYBOOK-2C/2D/2E/3A — Deterministic prompt orchestration (client-safe). */

import { buildGrowthAccountIntelligencePromptSectionsForChannel } from "@/lib/growth/account-intelligence/growth-account-intelligence-builder"
import { buildRegenerationFeedbackDirectives } from "@/lib/growth/playbooks/growth-industry-context"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type {
  GrowthNarrativeContext,
  GrowthPlaybookOrchestratedPrompt,
  GrowthPlaybookPromptChannel,
} from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import { buildGrowthPersonaPromptSectionsForChannel } from "@/lib/growth/playbooks/personas/growth-playbook-persona-messaging"
import { mapLegacyPromptChannelToOptimizationChannel } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-channel-rules"
import { optimizeGrowthPlaybookPrompt } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimizer"
import type { GrowthPlaybookOptimizationChannel } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"
import { buildGrowthNarrativeBriefPromptBlock } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"

function appendReasoningPlanningBlock(formattedBlock: string, industryContext: GrowthIndustryContext): string {
  const reasoning = industryContext.reasoningContext?.diagnostics
  const sequence = industryContext.sequenceIntelligenceContext?.diagnostics.guidance
  const blocks = [formattedBlock]
  if (reasoning) {
    blocks.push("", buildGrowthNarrativeBriefPromptBlock(reasoning.narrativeBrief, reasoning.messagePlan))
  }
  if (sequence) {
    blocks.push("", buildGrowthSequenceGuidancePromptBlock(sequence))
  }
  return blocks.join("\n")
}

function channelInstructions(channel: GrowthPlaybookPromptChannel): { emphasize: string[]; avoid: string[] } {
  const sharedAvoid = [
    "Claiming unverified company pain or events",
    "Inventing metrics, awards, or prior conversations",
    "Listing playbook bullets verbatim in final copy",
  ]

  switch (channel) {
    case "sms":
      return {
        emphasize: ["One industry insight", "One verified company hook if available", "Persona-appropriate soft CTA"],
        avoid: [...sharedAvoid, "Long paragraphs", "Multiple CTAs"],
      }
    case "voice":
      return {
        emphasize: ["Persona opening strategy", "Single storyline hook", "Persona-preferred proof", "Clear callback CTA"],
        avoid: [...sharedAvoid, "Dense jargon", "Written-email phrasing"],
      }
    case "page":
      return {
        emphasize: ["Persona messaging blocks", "Headline tied to narrative", "Persona-preferred proof and CTA"],
        avoid: [...sharedAvoid, "Generic template language"],
      }
    case "copilot":
      return {
        emphasize: ["Operator-ready guidance", "Persona framework diagnostics", "Objection-aware phrasing"],
        avoid: [...sharedAvoid, "Autonomous send language"],
      }
    default:
      return {
        emphasize: [
          "Persona-first messaging before product pitch",
          "Industry relevance with persona language",
          "Verified company facts when available",
          "Persona-preferred proof and CTA",
        ],
        avoid: sharedAvoid,
      }
  }
}

function buildOrchestratedSections(input: {
  industryContext: GrowthIndustryContext
  narrativeContext: GrowthNarrativeContext | null
  channel: GrowthPlaybookPromptChannel
  optimizationChannel: GrowthPlaybookOptimizationChannel
}): {
  base: Omit<GrowthPlaybookOrchestratedPrompt, "formattedBlock" | "promptOptimization">
  header: string
  vocabulary?: string
  regenerationBlock?: string
} {
  const { industryContext: context, narrativeContext: narrative, channel, optimizationChannel } = input
  const { emphasize, avoid } = channelInstructions(channel)

  const personaContext = context.personaMessagingContext
  const personaSections = buildGrowthPersonaPromptSectionsForChannel(personaContext, optimizationChannel)
  const accountSections = buildGrowthAccountIntelligencePromptSectionsForChannel(
    context.accountIntelligenceContext,
    optimizationChannel,
  )

  const verifiedCompanyFacts =
    context.verifiedFacts.length > 0
      ? context.verifiedFacts.map((fact) => `- ${fact}`).join("\n")
      : "- None verified — do not invent company-specific claims."

  const industryLines = [
    ...context.industryFacts.map((fact) => `- ${fact}`),
    ...(context.capabilityMappings.length
      ? context.capabilityMappings.map((entry) => `- ${entry.industryFraming}`)
      : []),
    ...(context.discoveryQuestions.length
      ? [`Discovery angles:\n${context.discoveryQuestions.map((q) => `- ${q}`).join("\n")}`]
      : []),
  ]
  const industryIntelligence = industryLines.length > 0 ? industryLines.join("\n") : "- No industry playbook applied."

  const narrativeDirection = narrative
    ? [
        `Primary narrative (${narrative.narrativeType}): ${narrative.primaryNarrative}`,
        `Secondary narrative: ${narrative.secondaryNarrative}`,
        `Opening guidance: ${narrative.recommendedOpening}`,
        `Narrative goals:\n${narrative.narrativeGoals.map((goal) => `- ${goal}`).join("\n")}`,
      ].join("\n")
    : "- Use industry context with 'teams in this space often…' phrasing."

  const buyerPersona = narrative?.buyerPersona
    ? [
        `Primary persona: ${narrative.buyerPersona.title}`,
        `Lead with: ${narrative.leadWith.replace(/_/g, " ")}`,
        `Goals: ${narrative.buyerPersona.goals.slice(0, 2).join("; ")}`,
        narrative.secondaryBuyerPersona ? `Secondary persona: ${narrative.secondaryBuyerPersona.title}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "No persona selected — use general operator-to-operator tone."

  const recommendedTone = narrative
    ? `${narrative.recommendedTone} — adjust phrasing for ${channel} without changing factual constraints.`
    : "Consultative — professional and discovery-oriented."

  const proofPoints = narrative?.recommendedProof
    ? narrative.recommendedProof
    : context.capabilityMappings[0]?.industryFraming ?? "Use capability mapping only if supported by context."

  const ctaGuidance = [
    narrative?.recommendedCTA ? `Primary CTA: ${narrative.recommendedCTA}` : null,
    context.recommendedCtas[1] ? `Secondary CTA: ${context.recommendedCtas[1]}` : null,
    context.recommendedCtas[2] ? `Tertiary CTA: ${context.recommendedCtas[2]}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const objectionAwareness =
    narrative?.objectionAwareness.length
      ? narrative.objectionAwareness
          .map(
            (entry) =>
              `- "${entry.objection}" → Response: ${entry.recommendedResponse} | Discovery: ${entry.recommendedDiscoveryQuestion}`,
          )
          .join("\n")
      : "- No structured objections selected."

  const ratio = narrative?.companyVsIndustryRatio
  const weightingInstructions = ratio
    ? `Weight verified company facts ~${ratio.companyPercent}% and industry intelligence ~${ratio.industryPercent}%. ${ratio.rationale}`
    : "Prefer verified company facts over industry patterns when both are available."

  const feedbackDirectives = buildRegenerationFeedbackDirectives(context.regenerationFeedback)
  const regenerationBlock =
    feedbackDirectives.length > 0
      ? `Operator regeneration feedback:\n- ${feedbackDirectives.join("\n- ")}`
      : undefined

  const vocabulary = context.playbookContext?.selectedVocabulary.length
    ? `Industry vocabulary (use naturally): ${context.playbookContext.selectedVocabulary.join(", ")}`
    : undefined

  return {
    base: {
      verifiedCompanyFacts,
      verifiedCompanySummary: accountSections.verifiedCompanySummary,
      verifiedOperationalSignals: accountSections.verifiedOperationalSignals,
      verifiedGrowthSignals: accountSections.verifiedGrowthSignals,
      verifiedTechnologySignals: accountSections.verifiedTechnologySignals,
      verifiedCustomerSignals: accountSections.verifiedCustomerSignals,
      verifiedDifferentiators: accountSections.verifiedDifferentiators,
      industryIntelligence,
      narrativeDirection,
      buyerPersona,
      buyerPersonaFramework: personaSections.buyerPersonaFramework,
      recommendedLanguage: personaSections.recommendedLanguage,
      preferredProof: personaSections.preferredProof,
      preferredCta: personaSections.preferredCta,
      topicsToAvoid: personaSections.topicsToAvoid,
      recommendedTone,
      proofPoints,
      ctaGuidance,
      objectionAwareness,
      weightingInstructions,
      emphasize,
      avoid,
      personaDiagnostics: personaContext?.diagnostics,
      accountIntelligenceDiagnostics: context.accountIntelligenceContext?.diagnostics,
      outcomeGuidanceDiagnostics: context.outcomeGuidanceContext?.diagnostics,
      buyerJourneyDiagnostics: context.buyerJourneyContext?.diagnostics,
      reasoningDiagnostics: context.reasoningContext?.diagnostics,
      sequenceDiagnostics: context.sequenceIntelligenceContext?.diagnostics,
    },
    header: `Industry playbook: ${context.playbook?.displayName ?? context.industryId ?? "general"} (${channel})`,
    vocabulary,
    regenerationBlock,
  }
}

function applyChannelOptimization(
  base: Omit<GrowthPlaybookOrchestratedPrompt, "formattedBlock" | "promptOptimization">,
  input: {
    channel: GrowthPlaybookPromptChannel
    optimizationChannel?: GrowthPlaybookOptimizationChannel
    header: string
    vocabulary?: string
    regenerationBlock?: string
    narrativeContext: GrowthNarrativeContext | null
    industryContext: GrowthIndustryContext
  },
): GrowthPlaybookOrchestratedPrompt {
  const optimizationChannel =
    input.optimizationChannel ?? mapLegacyPromptChannelToOptimizationChannel(input.channel)

  const orchestratedForOptimizer: GrowthPlaybookOrchestratedPrompt = {
    ...base,
    formattedBlock: "",
  }

  const optimized = optimizeGrowthPlaybookPrompt({
    channel: optimizationChannel,
    orchestrated: orchestratedForOptimizer,
    header: [
      input.header,
      "Use industry phrasing like 'Teams in this space often…' or 'Companies like yours often…'. Never claim unverified company-specific pain.",
    ].join("\n"),
    vocabulary: input.vocabulary,
    regenerationBlock: input.regenerationBlock,
    narrativeContext: input.narrativeContext,
    industryContext: input.industryContext,
    verifiedFacts: input.industryContext.verifiedFacts,
  })

  return {
    ...base,
    formattedBlock: appendReasoningPlanningBlock(optimized.optimizedPrompt, input.industryContext),
    promptOptimization: optimized.diagnostics,
  }
}

function formatSkipOptimizationBlock(
  built: ReturnType<typeof buildOrchestratedSections>,
): string {
  return [
    built.header,
    "Use industry phrasing like 'Teams in this space often…' or 'Companies like yours often…'. Never claim unverified company-specific pain.",
    "",
    "=== Verified Company Facts ===",
    built.base.verifiedCompanyFacts,
    "",
    "=== Verified Company Summary ===",
    built.base.verifiedCompanySummary,
    "",
    "=== Verified Operational Signals ===",
    built.base.verifiedOperationalSignals,
    "",
    "=== Verified Growth Signals ===",
    built.base.verifiedGrowthSignals,
    "",
    "=== Verified Technology Signals ===",
    built.base.verifiedTechnologySignals,
    "",
    "=== Verified Customer Signals ===",
    built.base.verifiedCustomerSignals,
    "",
    "=== Verified Differentiators ===",
    built.base.verifiedDifferentiators,
    "",
    "=== Industry Intelligence (not verified for this company) ===",
    built.base.industryIntelligence,
    "",
    "=== Narrative Direction ===",
    built.base.narrativeDirection,
    "",
    "=== Buyer Persona Framework ===",
    built.base.buyerPersonaFramework,
    "",
    "=== Recommended Language ===",
    built.base.recommendedLanguage,
    "",
    "=== Preferred Proof ===",
    built.base.preferredProof,
    "",
    "=== Preferred CTA ===",
    built.base.preferredCta,
    "",
    "=== Topics To Avoid ===",
    built.base.topicsToAvoid,
    "",
    "=== Recommended Tone ===",
    built.base.recommendedTone,
    "",
    "=== Proof Points ===",
    built.base.proofPoints,
    "",
    "=== CTA Guidance ===",
    built.base.ctaGuidance || "- Use a consultative, low-pressure question.",
    "",
    "=== Objection Awareness ===",
    built.base.objectionAwareness,
    "",
    "=== Context Weighting ===",
    built.base.weightingInstructions,
    "",
    "=== Emphasize ===",
    built.base.emphasize.map((entry) => `- ${entry}`).join("\n"),
    "",
    "=== Avoid ===",
    built.base.avoid.map((entry) => `- ${entry}`).join("\n"),
    built.vocabulary,
    built.regenerationBlock,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildGrowthPlaybookOrchestratedPrompt(input: {
  industryContext: GrowthIndustryContext | null
  narrativeContext: GrowthNarrativeContext | null
  channel?: GrowthPlaybookPromptChannel
  optimizationChannel?: GrowthPlaybookOptimizationChannel
  skipOptimization?: boolean
}): GrowthPlaybookOrchestratedPrompt | null {
  if (!input.industryContext?.playbookApplied) return null

  const channel = input.channel ?? "email"
  const optimizationChannel =
    input.optimizationChannel ?? mapLegacyPromptChannelToOptimizationChannel(channel)
  const built = buildOrchestratedSections({
    industryContext: input.industryContext,
    narrativeContext: input.narrativeContext,
    channel,
    optimizationChannel,
  })

  if (input.skipOptimization) {
    return {
      ...built.base,
      formattedBlock: appendReasoningPlanningBlock(formatSkipOptimizationBlock(built), input.industryContext),
    }
  }

  return applyChannelOptimization(built.base, {
    channel,
    optimizationChannel: input.optimizationChannel,
    header: built.header,
    vocabulary: built.vocabulary,
    regenerationBlock: built.regenerationBlock,
    narrativeContext: input.narrativeContext,
    industryContext: input.industryContext,
  })
}

export function buildGrowthPlaybookOrchestratedPromptBlock(input: {
  industryContext: GrowthIndustryContext | null
  narrativeContext: GrowthNarrativeContext | null
  channel?: GrowthPlaybookPromptChannel
  optimizationChannel?: GrowthPlaybookOptimizationChannel
}): string {
  return buildGrowthPlaybookOrchestratedPrompt(input)?.formattedBlock ?? ""
}
