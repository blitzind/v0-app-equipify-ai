/** GS-AI-PLAYBOOK-2D — Channel-aware prompt optimizer (client-safe). */

import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { GrowthNarrativeContext } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import type { GrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import {
  capIndustryIntelligence,
  capObjectionAwareness,
  formatOrchestratedSectionBlock,
  GROWTH_PLAYBOOK_ALL_PROMPT_SECTION_KEYS,
  GROWTH_PLAYBOOK_CHANNEL_RULES,
  GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM,
  GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-channel-rules"
import {
  estimatePromptBudgetUtilization,
  getPromptBudgetLimitForChannel,
  getPromptBudgetTierForChannel,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-budget-service"
import {
  GROWTH_PLAYBOOK_PROMPT_OPTIMIZATION_QA_MARKER,
  type GrowthPlaybookOptimizationChannel,
  type GrowthPlaybookOptimizedPromptResult,
  type GrowthPlaybookOrchestratedSections,
  type GrowthPlaybookPromptOptimizationStrategy,
  type GrowthPlaybookPromptSectionKey,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"

export { GROWTH_PLAYBOOK_PROMPT_OPTIMIZATION_QA_MARKER }

function compressSectionForChannel(
  channel: GrowthPlaybookOptimizationChannel,
  key: GrowthPlaybookPromptSectionKey,
  body: string,
): string {
  if (channel === "SMS") {
    if (key === "narrative_direction") {
      return body
        .split("\n")
        .filter((line) => !line.startsWith("Narrative goals:") && !line.startsWith("- Weight"))
        .slice(0, 2)
        .join("\n")
    }
    if (key === "cta_guidance" || key === "preferred_cta") {
      return body.split("\n").slice(0, 1).join("\n")
    }
    if (key === "context_weighting") {
      const firstSentence = body.split(". ").slice(0, 1).join(". ")
      return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`
    }
    if (key === "recommended_tone" || key === "recommended_language") {
      const firstLine = body.split("\n")[0] ?? body
      return firstLine.split(" — ")[0] ?? firstLine
    }
    if (key === "verified_company_summary") {
      return body.split("\n").slice(0, 2).join("\n")
    }
    if (key === "topics_to_avoid") {
      return body.split("\n").slice(0, 2).join("\n")
    }
  }

  if (channel === "VOICE" && key === "narrative_direction") {
    return body.split("\n").slice(0, 3).join("\n")
  }

  if (channel === "VOICE" && key === "verified_company_summary") {
    return body.split("\n").slice(0, 2).join("\n")
  }

  return body
}

function enforceChannelBudget(input: {
  channel: GrowthPlaybookOptimizationChannel
  sections: GrowthPlaybookOrchestratedSections
  header: string
  active: Set<GrowthPlaybookPromptSectionKey>
  budgetLimit: number
}): GrowthPlaybookOrchestratedSections {
  let sections = { ...input.sections }
  const build = () =>
    assemblePromptFromSections({
      header: input.header,
      sections: Object.fromEntries([...input.active].map((key) => [key, sections[key]])) as Partial<
        Record<GrowthPlaybookPromptSectionKey, string>
      >,
      vocabulary: input.channel === "SMS" || input.channel === "VOICE" ? undefined : sections.vocabulary,
      regenerationBlock: input.channel === "SMS" ? undefined : sections.regenerationBlock,
    })

  if (build().length <= input.budgetLimit) return sections

  for (const key of GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM) {
    if (!input.active.has(key)) continue
    sections[key] = compressSectionForChannel(input.channel, key, sections[key])
  }

  return sections
}

function orchestratedPromptToSections(
  orchestrated: GrowthPlaybookOrchestratedPrompt,
  extras?: { header?: string; vocabulary?: string; regenerationBlock?: string },
): GrowthPlaybookOrchestratedSections {
  return {
    header: extras?.header ?? "",
    verified_company_facts: orchestrated.verifiedCompanyFacts,
    verified_company_summary: orchestrated.verifiedCompanySummary,
    verified_operational_signals: orchestrated.verifiedOperationalSignals,
    verified_growth_signals: orchestrated.verifiedGrowthSignals,
    verified_technology_signals: orchestrated.verifiedTechnologySignals,
    verified_customer_signals: orchestrated.verifiedCustomerSignals,
    verified_differentiators: orchestrated.verifiedDifferentiators,
    industry_intelligence: orchestrated.industryIntelligence,
    narrative_direction: orchestrated.narrativeDirection,
    buyer_persona: orchestrated.buyerPersona,
    buyer_persona_framework: orchestrated.buyerPersonaFramework,
    recommended_language: orchestrated.recommendedLanguage,
    preferred_proof: orchestrated.preferredProof,
    preferred_cta: orchestrated.preferredCta,
    topics_to_avoid: orchestrated.topicsToAvoid,
    recommended_tone: orchestrated.recommendedTone,
    proof_points: orchestrated.proofPoints,
    cta_guidance: orchestrated.ctaGuidance,
    objection_awareness: orchestrated.objectionAwareness,
    context_weighting: orchestrated.weightingInstructions,
    emphasize: orchestrated.emphasize.map((entry) => `- ${entry}`).join("\n"),
    avoid: orchestrated.avoid.map((entry) => `- ${entry}`).join("\n"),
    vocabulary: extras?.vocabulary,
    regenerationBlock: extras?.regenerationBlock,
  }
}

function applyChannelCaps(
  channel: GrowthPlaybookOptimizationChannel,
  sections: GrowthPlaybookOrchestratedSections,
): GrowthPlaybookOrchestratedSections {
  const rule = GROWTH_PLAYBOOK_CHANNEL_RULES[channel]
  return {
    ...sections,
    industry_intelligence: capIndustryIntelligence(sections.industry_intelligence, rule.industryMaxLines),
    objection_awareness: capObjectionAwareness(sections.objection_awareness, rule.objectionMaxItems),
  }
}

function assemblePromptFromSections(input: {
  header: string
  sections: Partial<Record<GrowthPlaybookPromptSectionKey, string>>
  vocabulary?: string
  regenerationBlock?: string
}): string {
  const parts = [input.header].filter(Boolean)
  for (const key of GROWTH_PLAYBOOK_ALL_PROMPT_SECTION_KEYS) {
    const body = input.sections[key]
    if (!body?.trim()) continue
    parts.push("", formatOrchestratedSectionBlock(key, body))
  }
  if (input.vocabulary?.trim()) {
    parts.push("", input.vocabulary.trim())
  }
  if (input.regenerationBlock?.trim()) {
    parts.push(input.regenerationBlock.trim())
  }
  return parts.join("\n").trim()
}

function weightingPreserved(prompt: string, weighting: string): boolean {
  return /~\d+%/.test(prompt) && /company/i.test(prompt) && /industry/i.test(prompt)
}

export function optimizeGrowthPlaybookPrompt(input: {
  channel: GrowthPlaybookOptimizationChannel
  orchestrated: GrowthPlaybookOrchestratedPrompt
  header?: string
  vocabulary?: string
  regenerationBlock?: string
  /** Accepted for API parity with spec — weighting is always taken from orchestrated output. */
  narrativeContext?: GrowthNarrativeContext | null
  industryContext?: GrowthIndustryContext | null
  verifiedFacts?: string[]
}): GrowthPlaybookOptimizedPromptResult {
  const channel = input.channel
  const rule = GROWTH_PLAYBOOK_CHANNEL_RULES[channel]
  const budgetLimit = getPromptBudgetLimitForChannel(channel)
  const budgetTier = getPromptBudgetTierForChannel(channel)

  let sections = applyChannelCaps(channel, orchestratedPromptToSections(input.orchestrated, input))
  const header =
    input.header ??
    `Industry playbook orchestration (${channel}) — use consultative phrasing; never claim unverified company pain.`

  const omittedByChannel = new Set<GrowthPlaybookPromptSectionKey>(rule.omitByDefault)

  let activeSections = new Set<GrowthPlaybookPromptSectionKey>(
    rule.include.filter((key) => !omittedByChannel.has(key)),
  )

  let strategy: GrowthPlaybookPromptOptimizationStrategy = "channel_defaults"
  const trimmedSections: GrowthPlaybookPromptSectionKey[] = []

  sections = enforceChannelBudget({
    channel,
    sections,
    header: [
      header,
      "Use industry phrasing like 'Teams in this space often…' or 'Companies like yours often…'. Never claim unverified company-specific pain.",
    ].join("\n"),
    active: activeSections,
    budgetLimit,
  })

  function buildPrompt(active: Set<GrowthPlaybookPromptSectionKey>): string {
    const selected: Partial<Record<GrowthPlaybookPromptSectionKey, string>> = {}
    for (const key of active) {
      selected[key] = sections[key]
    }
    return assemblePromptFromSections({
      header: [
        header,
        "Use industry phrasing like 'Teams in this space often…' or 'Companies like yours often…'. Never claim unverified company-specific pain.",
      ].join("\n"),
      sections: selected,
      vocabulary: channel === "SMS" || channel === "VOICE" ? undefined : sections.vocabulary,
      regenerationBlock: channel === "SMS" ? undefined : sections.regenerationBlock,
    })
  }

  let prompt = buildPrompt(activeSections)
  if (prompt.length <= budgetLimit) {
    if (activeSections.size === rule.include.length && omittedByChannel.size === 0) {
      strategy = channel === "COPILOT" ? "full_context" : "channel_defaults"
    }
  }

  if (prompt.length > budgetLimit) {
    strategy = "budget_trim"
    const trimOrder =
      channel === "SMS"
        ? ([
            "verified_company_summary",
            "topics_to_avoid",
            "recommended_language",
            ...GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER,
          ] as GrowthPlaybookPromptSectionKey[])
        : GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER
    for (const key of trimOrder) {
      if (GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM.includes(key)) continue
      if (!activeSections.has(key)) continue
      activeSections.delete(key)
      trimmedSections.push(key)
      prompt = buildPrompt(activeSections)
      if (prompt.length <= budgetLimit) break
    }
  }

  if (prompt.length > budgetLimit && channel !== "COPILOT") {
    for (const key of ["buyer_persona_framework", "buyer_persona"] as GrowthPlaybookPromptSectionKey[]) {
      if (!activeSections.has(key)) continue
      activeSections.delete(key)
      trimmedSections.push(key)
      prompt = buildPrompt(activeSections)
      if (prompt.length <= budgetLimit) break
    }
  }

  const includedSections = [...activeSections]
  const omittedSections = GROWTH_PLAYBOOK_ALL_PROMPT_SECTION_KEYS.filter((key) => !activeSections.has(key))

  return {
    optimizedPrompt: prompt,
    includedSections,
    omittedSections,
    budgetUtilization: estimatePromptBudgetUtilization(prompt.length, budgetLimit),
    diagnostics: {
      channel,
      budgetTier,
      estimatedPromptSize: prompt.length,
      budgetLimit,
      sectionsIncluded: includedSections,
      sectionsTrimmed: trimmedSections,
      sectionsOmitted: omittedSections,
      budgetUtilization: estimatePromptBudgetUtilization(prompt.length, budgetLimit),
      optimizationStrategy: strategy,
      weightingPreserved: weightingPreserved(prompt, sections.context_weighting),
    },
  }
}
