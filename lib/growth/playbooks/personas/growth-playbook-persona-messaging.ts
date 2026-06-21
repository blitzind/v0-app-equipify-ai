/** GS-AI-PLAYBOOK-2E — Persona-first messaging builder (client-safe). */

import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { GrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import type { GrowthPlaybookOptimizationChannel } from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"
import {
  buildPersonaFrameworkFromArchetype,
  getPersonaCtaLabel,
  getPersonaProofLabel,
  resolvePersonaArchetype,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-frameworks"
import { buildPersonaLanguageBlock } from "@/lib/growth/playbooks/personas/growth-playbook-persona-language"
import {
  GROWTH_PLAYBOOK_PERSONA_MESSAGING_QA_MARKER,
  type GrowthPersonaMessagingContext,
  type GrowthPersonaMessagingDiagnostics,
  type GrowthPersonaPromptSections,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type { GrowthIndustryPlaybookBuyerPersona } from "@/lib/growth/playbooks/industry-playbook-types"

export { GROWTH_PLAYBOOK_PERSONA_MESSAGING_QA_MARKER }

function selectPreferredProof(framework: ReturnType<typeof buildPersonaFrameworkFromArchetype>, narrativeProof: string | null): string {
  const primary = framework.preferredProofTypes[0]
  const secondary = framework.preferredProofTypes[1]
  const personaProof = [primary, secondary].filter(Boolean).map((type) => getPersonaProofLabel(type!)).join("; ")
  if (narrativeProof) {
    return `${personaProof}. Align capability proof: ${narrativeProof}`
  }
  return personaProof
}

function selectPreferredCta(
  framework: ReturnType<typeof buildPersonaFrameworkFromArchetype>,
  narrativeCta: string | null,
): string {
  const personaCta = getPersonaCtaLabel(framework.preferredCtaTypes[0] ?? "consultative_discovery")
  if (narrativeCta && !narrativeCta.toLowerCase().includes(personaCta.slice(0, 20).toLowerCase())) {
    return `Primary (persona): ${personaCta} Secondary (playbook): ${narrativeCta}`
  }
  return personaCta
}

function buildPersonaFrameworkBlock(framework: ReturnType<typeof buildPersonaFrameworkFromArchetype>): string {
  return [
    `Persona: ${framework.persona.title} (${framework.archetype.replace(/_/g, " ")})`,
    `Priorities: ${framework.priorities.slice(0, 5).join("; ")}`,
    `Fears / frustrations: ${framework.fears.slice(0, 4).join("; ")}`,
    `Desired outcomes: ${framework.desiredOutcomes.slice(0, 4).join("; ")}`,
    `Buying triggers: ${framework.buyingTriggers.slice(0, 4).join("; ")}`,
    `Recommended metrics: ${framework.recommendedMetrics.slice(0, 4).join("; ")}`,
    `Urgency drivers: ${framework.urgencyDrivers.slice(0, 3).join("; ")}`,
  ].join("\n")
}

function fallbackPersona(): GrowthIndustryPlaybookBuyerPersona {
  return {
    title: "Operations Leader",
    goals: ["Improve service visibility", "Reduce manual coordination"],
    kpis: ["response time", "repeat visits"],
    frustrations: ["disconnected systems", "manual reporting"],
    buyingTriggers: ["growth pressure", "customer escalations"],
    commonObjections: ["too busy to change tools"],
    successMetrics: ["faster closeout", "better visibility"],
  }
}

export function buildGrowthPersonaMessagingContext(input: {
  industryContext: GrowthIndustryContext
  narrativeContext?: GrowthNarrativeContext | null
  decisionMakerTitle?: string | null
}): GrowthPersonaMessagingContext | null {
  if (!input.industryContext.playbookApplied) return null

  const playbookPersona =
    input.industryContext.playbookContext?.primaryPersona ??
    input.narrativeContext?.buyerPersona ??
    input.industryContext.narrativeContext?.buyerPersona ??
    null

  const persona = playbookPersona ?? fallbackPersona()
  const titleForMatch = playbookPersona?.title ?? input.decisionMakerTitle ?? "Operations Leader"
  const resolved = resolvePersonaArchetype(titleForMatch, input.decisionMakerTitle)
  const outcomeGuidance = input.industryContext.outcomeGuidanceContext?.guidance ?? null
  const buyerGuidance = input.industryContext.buyerJourneyContext?.messagingGuidance ?? null
  const frameworkBase = buildPersonaFrameworkFromArchetype(persona, resolved.archetype)
  const framework =
    outcomeGuidance || buyerGuidance
      ? {
          ...frameworkBase,
          preferredProofTypes: outcomeGuidance
            ? [
                ...outcomeGuidance.preferredProofTypes.filter((type) => frameworkBase.preferredProofTypes.includes(type)),
                ...frameworkBase.preferredProofTypes,
              ].filter((value, index, array) => array.indexOf(value) === index)
            : frameworkBase.preferredProofTypes,
          preferredCtaTypes: outcomeGuidance
            ? [
                ...outcomeGuidance.preferredCtaTypes.filter((type) => frameworkBase.preferredCtaTypes.includes(type)),
                ...frameworkBase.preferredCtaTypes,
              ].filter((value, index, array) => array.indexOf(value) === index)
            : frameworkBase.preferredCtaTypes,
          avoidTopics: [
            ...new Set([
              ...frameworkBase.avoidTopics,
              ...(outcomeGuidance?.avoidPatterns ?? []),
              ...(buyerGuidance?.avoidActions ?? []),
            ]),
          ],
        }
      : frameworkBase

  const preferredProof = selectPreferredProof(
    framework,
    input.narrativeContext?.recommendedProof ?? input.industryContext.narrativeContext?.recommendedProof ?? null,
  )
  const preferredCta = selectPreferredCta(
    framework,
    input.narrativeContext?.recommendedCTA ?? input.industryContext.narrativeContext?.recommendedCTA ?? null,
  )

  const diagnostics: GrowthPersonaMessagingDiagnostics = {
    persona: persona.title,
    archetype: resolved.archetype,
    frameworkApplied: resolved.archetype !== "general" || Boolean(playbookPersona),
    preferredLanguage: framework.languageStyle,
    preferredProof,
    preferredCta,
    topicsAvoided: framework.avoidTopics,
    confidence: playbookPersona ? resolved.confidence : "low",
    matchReason: resolved.matchReason,
    outcomeGuidanceDiagnostics: input.industryContext.outcomeGuidanceContext?.diagnostics ?? null,
    buyerJourneyDiagnostics: input.industryContext.buyerJourneyContext?.diagnostics ?? null,
  }

  return {
    framework,
    diagnostics,
    recommendedLanguageBlock: buildPersonaLanguageBlock(framework),
    preferredProofBlock: preferredProof,
    preferredCtaBlock: preferredCta,
    topicsToAvoidBlock: framework.avoidTopics.map((entry) => `- ${entry}`).join("\n"),
    personaFrameworkBlock: buildPersonaFrameworkBlock(framework),
  }
}

export function buildGrowthPersonaPromptSections(
  personaContext: GrowthPersonaMessagingContext | null,
): GrowthPersonaPromptSections {
  if (!personaContext) {
    return {
      buyerPersonaFramework: "No persona framework applied — use consultative general operator tone.",
      recommendedLanguage: "Consultative — professional and discovery-oriented.",
      preferredProof: "Use capability mapping only when supported by verified or industry context.",
      preferredCta: "Open to a brief workflow review?",
      topicsToAvoid: "- Unverified company-specific pain\n- Aggressive closing language",
    }
  }

  return {
    buyerPersonaFramework: personaContext.personaFrameworkBlock,
    recommendedLanguage: personaContext.recommendedLanguageBlock,
    preferredProof: personaContext.preferredProofBlock,
    preferredCta: personaContext.preferredCtaBlock,
    topicsToAvoid: personaContext.topicsToAvoidBlock,
  }
}

export function buildGrowthPersonaPromptSectionsForChannel(
  personaContext: GrowthPersonaMessagingContext | null,
  channel: GrowthPlaybookOptimizationChannel,
): GrowthPersonaPromptSections {
  const full = buildGrowthPersonaPromptSections(personaContext)
  if (!personaContext) return full

  switch (channel) {
    case "SMS":
      return {
        buyerPersonaFramework: `Persona: ${personaContext.framework.persona.title} — prioritize ${personaContext.framework.priorities.slice(0, 2).join(", ")}.`,
        recommendedLanguage: `Tone: ${personaContext.framework.languageStyle}. Keep extremely concise.`,
        preferredProof: personaContext.framework.preferredProofTypes[0]
          ? getPersonaProofLabel(personaContext.framework.preferredProofTypes[0])
          : full.preferredProof,
        preferredCta: full.preferredCta,
        topicsToAvoid: personaContext.framework.avoidTopics.slice(0, 3).map((entry) => `- ${entry}`).join("\n"),
      }
    case "VOICE":
      return {
        buyerPersonaFramework: [
          `Persona: ${personaContext.framework.persona.title}`,
          `Opening: ${personaContext.framework.openingStrategies[0] ?? "Consultative opener"}`,
          `Priorities: ${personaContext.framework.priorities.slice(0, 3).join("; ")}`,
        ].join("\n"),
        recommendedLanguage: full.recommendedLanguage,
        preferredProof: full.preferredProof,
        preferredCta: full.preferredCta,
        topicsToAvoid: full.topicsToAvoid,
      }
    case "SHARE_PAGE":
      return {
        ...full,
        buyerPersonaFramework: [
          full.buyerPersonaFramework,
          `Messaging blocks: emphasize ${personaContext.framework.desiredOutcomes.slice(0, 2).join("; ")}`,
        ].join("\n"),
      }
    case "COPILOT":
      return {
        ...full,
        buyerPersonaFramework: [
          full.buyerPersonaFramework,
          `Diagnostics: archetype=${personaContext.diagnostics.archetype}; confidence=${personaContext.diagnostics.confidence}`,
        ].join("\n"),
      }
    default:
      return full
  }
}
