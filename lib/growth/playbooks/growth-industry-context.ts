/** GS-AI-PLAYBOOK-1C/2B — Unified industry context builder (client-safe). */

import { buildGrowthPlaybookContext, buildGrowthPlaybookContextFromSelection } from "@/lib/growth/playbooks/context/growth-playbook-context-builder"
import { applyGrowthPlaybookOutcomeGuidanceToPlaybookContext } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-engine"
import { applyGrowthBuyingStageGuidanceToPlaybookContext } from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
import { selectGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-selection-engine"
import { buildGrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-builder"
import { buildGrowthPersonaMessagingContext } from "@/lib/growth/playbooks/personas/growth-playbook-persona-messaging"
import { buildGrowthAccountIntelligence } from "@/lib/growth/account-intelligence/growth-account-intelligence-builder"
import { resolveIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-registry"
import {
  GROWTH_INDUSTRY_CONTEXT_MIN_CONFIDENCE,
  GROWTH_INDUSTRY_CONTEXT_QA_MARKER,
  type GrowthIndustryContext,
  type GrowthIndustryContextInput,
} from "@/lib/growth/playbooks/growth-industry-context-types"
import { GROWTH_INDUSTRY_TAXONOMY } from "@/lib/growth/playbooks/industry-taxonomy"
import {
  buildNeutralCapabilityParagraph,
  buildNeutralCapabilitySmsLine,
  buildNeutralCapabilityVoiceLine,
  buildNeutralIndustryCapabilityFraming,
  normalizeIndustryPlaybookModuleLabel,
} from "@/lib/growth/playbooks/industry-capability-normalization"
import type { GrowthOutreachPersonalizationOrganizationKnowledgeBlock } from "@/lib/growth/outreach/personalization/growth-outreach-personalization-organization-knowledge"

export {
  GROWTH_INDUSTRY_CONTEXT_MIN_CONFIDENCE,
  GROWTH_INDUSTRY_CONTEXT_QA_MARKER,
}
export type {
  GrowthIndustryContext,
  GrowthIndustryContextInput,
  GrowthIndustryContextRegenerationFeedback,
} from "@/lib/growth/playbooks/growth-industry-context-types"
export { buildGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-context-builder"
export { buildGrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-builder"
export {
  buildGrowthPlaybookOrchestratedPrompt,
  buildGrowthPlaybookOrchestratedPromptBlock,
} from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
export { optimizeGrowthPlaybookPrompt } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimizer"
export type { GrowthPlaybookOptimizationChannel } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"
export type { GrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-context-types"
export { buildGrowthPersonaMessagingContext } from "@/lib/growth/playbooks/personas/growth-playbook-persona-messaging"
export type { GrowthPersonaMessagingContext } from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
export { buildGrowthAccountIntelligence } from "@/lib/growth/account-intelligence/growth-account-intelligence-builder"
export type { GrowthAccountIntelligenceContext } from "@/lib/growth/account-intelligence/growth-account-intelligence-types"
export type { GrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
export {
  applyGrowthPlaybookOutcomeGuidanceToPlaybookContext,
  buildGrowthPlaybookOutcomeGuidance,
  buildGrowthPlaybookOutcomeOperatorPreview,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-engine"
export type {
  GrowthPlaybookOutcomeGuidanceContext,
  GrowthPlaybookOutcomeRecord,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
export {
  buildGrowthBuyingStageContextFromSignals,
  buildGrowthBuyingStageOperatorPreview,
} from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
export type { GrowthBuyingStageContext } from "@/lib/growth/buyer-journey/growth-buying-stage-types"
export type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))]
}

function industryFactPrefix(displayName: string): string {
  return `Teams in ${displayName} often`
}

function buildIndustryFactsFromSelection(
  displayName: string,
  selectedPains: string[],
  proofPoints: string[],
): string[] {
  const prefix = industryFactPrefix(displayName)
  return uniqueStrings([
    ...selectedPains.map((pain) => `${prefix} ${pain.replace(/\.$/, "")}.`),
    ...proofPoints.slice(0, 2).map((point) => `${prefix} benefit from ${point.replace(/\.$/, "")}.`),
  ])
}

function buildCapabilityMappingsFromSelection(
  displayName: string,
  mappings: Array<{ capability: string; painSignal: string; equipifyModule: string }>,
  organizationKnowledge?: GrowthOutreachPersonalizationOrganizationKnowledgeBlock | null,
): GrowthIndustryContext["capabilityMappings"] {
  return mappings.map((mapping) => ({
    capability: mapping.capability,
    painSignal: mapping.painSignal,
    equipifyModule: normalizeIndustryPlaybookModuleLabel(mapping.equipifyModule),
    industryFraming: buildNeutralIndustryCapabilityFraming({
      displayName,
      capability: mapping.capability,
      painSignal: mapping.painSignal,
      moduleLabel: mapping.equipifyModule,
      organizationKnowledge,
    }),
  }))
}

export function deriveLeadIndustryTagsFromContext(context: GrowthIndustryContext): string[] {
  const tags = new Set<string>()
  if (context.industryId) {
    tags.add(context.industryId)
    const taxonomy = GROWTH_INDUSTRY_TAXONOMY[context.industryId]
    tags.add(taxonomy.label.toLowerCase())
    for (const alias of taxonomy.aliases.slice(0, 6)) tags.add(alias.toLowerCase())
    for (const keyword of taxonomy.keywords.slice(0, 6)) tags.add(keyword.toLowerCase())
  }
  if (context.playbook?.displayName) tags.add(context.playbook.displayName.toLowerCase())
  return [...tags]
}

export function buildRegenerationFeedbackDirectives(
  feedback: GrowthIndustryContext["regenerationFeedback"],
): string[] {
  if (!feedback) return []
  const directives: string[] = []
  switch (feedback.category) {
    case "too_generic":
      directives.push("Increase specificity using verified company facts before industry context.")
      break
    case "wrong_industry_assumptions":
      directives.push("Treat industry context as low-confidence relevance only; do not lean on industry pains.")
      break
    case "too_salesy":
      directives.push("Use a softer, consultative tone; avoid hype and pressure language.")
      break
    case "missing_company_context":
      directives.push("Lead with verified company facts; keep industry context secondary.")
      break
    case "not_enough_personalization":
      directives.push("Prioritize verified research, memory, and engagement evidence over generic phrasing.")
      break
    case "custom":
      break
    default:
      break
  }
  if (feedback.customNotes?.trim()) {
    directives.push(`Operator feedback: ${feedback.customNotes.trim()}`)
  }
  return directives
}

export function buildGrowthIndustryContext(input: GrowthIndustryContextInput): GrowthIndustryContext {
  const verifiedFacts = uniqueStrings(input.verifiedFacts ?? [])
  const { resolution, playbook } = resolveIndustryPlaybook({
    companyName: input.companyName,
    industry: input.industryLabel,
    description: input.description,
    websiteText: input.websiteText,
    researchSummary: input.researchSummary,
    naics: input.naics,
    sic: input.sic,
  })

  const playbookApplied = Boolean(
    playbook && resolution.industryId && resolution.confidence >= GROWTH_INDUSTRY_CONTEXT_MIN_CONFIDENCE,
  )

  let resolvedPlaybookContext = null as ReturnType<typeof buildGrowthPlaybookContext> | null
  let outcomeGuidanceContext = null as import("@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types").GrowthPlaybookOutcomeGuidanceContext | null
  let buyerJourneyContext = null as import("@/lib/growth/buyer-journey/growth-buying-stage-types").GrowthBuyingStageContext | null

  if (playbookApplied && playbook && resolution.industryId) {
    const contextInput = {
      playbook,
      industryId: resolution.industryId,
      verifiedFacts,
      leadSignals: input.leadSignals,
      researchSignals: input.researchSignals ?? [input.researchSummary, input.description].filter(Boolean) as string[],
      hiringSignals: input.hiringSignals,
      websiteSignals: input.websiteSignals ?? [input.websiteText].filter(Boolean) as string[],
      evidenceLabels: input.evidenceLabels,
      companySize: input.companySize,
      decisionMakerTitle: input.decisionMakerTitle,
      regenerationFeedback: input.regenerationFeedback ?? null,
    }

    let selection = selectGrowthPlaybookContext(contextInput)

    if (input.outcomeRecords && input.outcomeRecords.length > 0) {
      const guided = applyGrowthPlaybookOutcomeGuidanceToPlaybookContext({
        contextInput,
        outcomeRecords: input.outcomeRecords,
      })
      selection = guided.selection
      outcomeGuidanceContext = guided.outcomeGuidanceContext
    }

    if (input.buyerJourneySignals) {
      const stageGuided = applyGrowthBuyingStageGuidanceToPlaybookContext({
        contextInput,
        buyingStageSignals: input.buyerJourneySignals,
        baseSelection: selection,
      })
      selection = stageGuided.selection
      buyerJourneyContext = stageGuided.buyingStageContext
    }

    resolvedPlaybookContext = buildGrowthPlaybookContextFromSelection(contextInput, selection)
  }

  const industryFacts =
    playbookApplied && playbook && resolvedPlaybookContext
      ? buildIndustryFactsFromSelection(playbook.displayName, resolvedPlaybookContext.selectedPains, playbook.proofPoints)
      : []

  const capabilityMappings =
    playbookApplied && playbook && resolvedPlaybookContext
      ? buildCapabilityMappingsFromSelection(
          playbook.displayName,
          resolvedPlaybookContext.selectedCapabilities,
          input.organizationKnowledge,
        )
      : []

  const discoveryQuestions = resolvedPlaybookContext?.selectedDiscoveryQuestions ?? []
  const videoStorylines = resolvedPlaybookContext?.selectedStorylines ?? []
  const recommendedCtas = resolvedPlaybookContext
    ? [resolvedPlaybookContext.primaryCta, resolvedPlaybookContext.secondaryCta, resolvedPlaybookContext.tertiaryCta].filter(
        (entry): entry is string => Boolean(entry),
      )
    : []

  const context: GrowthIndustryContext = {
    industryId: resolution.industryId,
    confidence: resolution.confidence,
    playbook: playbookApplied ? playbook : null,
    playbookContext: resolvedPlaybookContext,
    verifiedFacts,
    industryFacts,
    capabilityMappings,
    discoveryQuestions,
    videoStorylines,
    recommendedCtas,
    regenerationFeedback: input.regenerationFeedback ?? null,
    leadIndustryTags: [],
    playbookApplied,
    organizationKnowledge: input.organizationKnowledge ?? null,
    narrativeContext: null,
    personaMessagingContext: null,
    accountIntelligenceContext: buildGrowthAccountIntelligence({
      companyName: input.companyName,
      companySummary: input.description,
      websiteSummary: input.researchSummary,
      researchFindings: input.researchSignals,
      websiteText: input.websiteText,
      websiteSignals: input.websiteSignals,
      verifiedFacts,
      companySize: input.companySize,
      decisionMakerTitle: input.decisionMakerTitle,
      naics: input.naics,
      sic: input.sic,
      hiringSignals: input.hiringSignals,
      leadSignals: input.leadSignals,
      researchSignals: input.researchSignals,
      ...(input.accountIntelligence ?? {}),
    }),
    outcomeGuidanceContext,
    buyerJourneyContext,
  }

  context.narrativeContext = playbookApplied
    ? buildGrowthNarrativeContext({
        industryContext: context,
        leadSignals: [
          ...(input.leadSignals ?? []),
          ...(input.researchSignals ?? []),
          ...(input.hiringSignals ?? []),
        ],
        decisionMakerTitle: input.decisionMakerTitle,
      })
    : null

  context.personaMessagingContext = playbookApplied
    ? buildGrowthPersonaMessagingContext({
        industryContext: context,
        narrativeContext: context.narrativeContext,
        decisionMakerTitle: input.decisionMakerTitle,
      })
    : null

  context.leadIndustryTags = deriveLeadIndustryTagsFromContext(context)
  return context
}

export function buildIndustryContextEmailParagraphs(context: GrowthIndustryContext, companyName: string): {
  industryParagraph: string | null
  companyParagraph: string | null
  capabilityParagraph: string | null
  ctaParagraph: string | null
} {
  const displayName = context.playbook?.displayName ?? "this space"
  const primaryPain =
    context.playbookContext?.selectedPains[0]?.replace(/\.$/, "") ??
    context.playbook?.pains[0]?.replace(/\.$/, "")
  const industryParagraph = primaryPain
    ? `Many ${displayName.toLowerCase()} organizations often ${primaryPain}.`
    : context.industryFacts[0] ?? null

  const formatVerified = (fact: string): string => {
    const cleaned = fact
      .replace(/^(Summary|Website|Service focus|Observed|Hiring signal|Contact role|Site excerpt):\s*/i, "")
      .trim()
    if (/^(provides|supports|offers|specializes|delivers|maintains)\b/i.test(cleaned)) {
      return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
    }
    return cleaned
  }

  const companyBits = context.verifiedFacts.slice(0, 2).map(formatVerified)
  const companyParagraph =
    companyBits.length > 0
      ? `We noticed ${companyName} ${companyBits.join(" ").replace(new RegExp(`^${companyName}\\s*`, "i"), "")}`.replace(
          /\s{2,}/g,
          " ",
        )
      : companyName
        ? `We noticed ${companyName} supports operations in ${displayName.toLowerCase()}.`
        : null

  const mapping = context.capabilityMappings[0]
  const capabilityParagraph = mapping
    ? buildNeutralCapabilityParagraph({
        capability: mapping.capability,
        moduleLabel: mapping.equipifyModule,
        organizationKnowledge: context.organizationKnowledge,
      })
    : null

  const cta = context.playbookContext?.primaryCta ?? context.recommendedCtas[0] ?? "Open to a quick walkthrough?"
  const ctaParagraph = cta.endsWith("?") ? cta : `${cta}?`

  return { industryParagraph, companyParagraph, capabilityParagraph, ctaParagraph }
}

export function buildIndustryContextSmsDraft(context: GrowthIndustryContext): string | null {
  if (!context.playbookApplied) return null
  const pain = context.industryFacts[0]?.replace(/^Teams in [^.]+ often /i, "")?.replace(/\.$/, "")
  const mapping = context.capabilityMappings[0]
  if (!pain && !mapping) return null
  const painLine = pain ? `${context.playbook?.displayName ?? "Teams"} often struggle with ${pain.toLowerCase()}.` : ""
  const capabilityLine = mapping
    ? buildNeutralCapabilitySmsLine({
        capability: mapping.capability,
        moduleLabel: mapping.equipifyModule,
        organizationKnowledge: context.organizationKnowledge,
      })
    : ""
  const cta = context.playbookContext?.primaryCta ?? "Worth a quick conversation?"
  return [painLine, capabilityLine, cta.endsWith("?") ? cta : `${cta}?`].filter(Boolean).join(" ")
}

export function buildIndustryContextVoiceScript(context: GrowthIndustryContext, companyName: string): string | null {
  if (!context.playbookApplied) return null
  const hook = context.videoStorylines[0]?.hook ?? context.industryFacts[0]
  const mapping = context.capabilityMappings[0]
  if (!hook) return null
  return [
    `Hi — quick note for ${companyName}.`,
    hook.replace(/\.$/, "") + ".",
    mapping
      ? buildNeutralCapabilityVoiceLine({
          capability: mapping.capability,
          organizationKnowledge: context.organizationKnowledge,
        })
      : "",
    context.playbookContext?.primaryCta ?? context.recommendedCtas[0] ?? "Happy to share a brief walkthrough if useful.",
  ]
    .filter(Boolean)
    .join(" ")
}
