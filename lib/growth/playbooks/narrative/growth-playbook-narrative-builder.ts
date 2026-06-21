/** GS-AI-PLAYBOOK-2C — Deterministic narrative builder (client-safe). */

import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { GrowthPlaybookSelectionTheme } from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import {
  GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER,
  type GrowthNarrativeCompanyVsIndustryRatio,
  type GrowthNarrativeContext,
  type GrowthNarrativeContextInput,
  type GrowthNarrativeLeadWith,
  type GrowthNarrativeTone,
  type GrowthNarrativeType,
} from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"

export { GROWTH_PLAYBOOK_NARRATIVE_QA_MARKER }

const OPENING_TEMPLATES: Record<GrowthNarrativeType, string> = {
  workflow:
    "Many organizations eventually reach a point where preventive maintenance schedules and work orders live in separate systems — opening guidance should acknowledge that transition without claiming it applies to this company unless verified.",
  scaling:
    "As service organizations expand technician headcount and contract volume, coordination gaps often appear before leadership has bandwidth to redesign workflows — use consultative framing.",
  compliance:
    "Teams responsible for regulated equipment often discover documentation gaps only when audit or recall pressure intensifies — emphasize traceability, not fear.",
  financial:
    "Growing service organizations frequently find revenue leakage in delayed invoicing, unbilled labor, or warranty exposure — frame as operational finance, not accounting criticism.",
  operational_complexity:
    "Multi-location service operators often inherit fragmented dispatch boards and inconsistent PM execution — acknowledge complexity without assuming this company's exact structure.",
  growth:
    "As service organizations expand recurring contracts and installed-base coverage, visibility gaps between sales promises and field execution become more visible — stay consultative.",
  general:
    "Teams in this space often evaluate whether their current workflows still match how the business operates today — keep relevance high and claims modest.",
}

const NARRATIVE_DESCRIPTIONS: Record<GrowthNarrativeType, { primary: string; secondary: string }> = {
  workflow: {
    primary: "Workflow narrative — emphasize PM coordination, work order linkage, and technician follow-through.",
    secondary: "Connect operational friction to measurable service reliability without inventing company-specific metrics.",
  },
  compliance: {
    primary: "Compliance narrative — emphasize audit-ready records, recall traceability, and inspection documentation.",
    secondary: "Position Equipify as reducing survey prep burden while keeping clinical/regulatory language accurate.",
  },
  scaling: {
    primary: "Scaling narrative — emphasize hiring, dispatch capacity, technician utilization, and onboarding consistency.",
    secondary: "Acknowledge growth pressure without assuming current headcount or backlog for this company.",
  },
  financial: {
    primary: "Financial narrative — emphasize revenue leakage, billing timeliness, contract margin, and warranty exposure.",
    secondary: "Tie operational improvements to billing accuracy and contract renewals using industry-level framing.",
  },
  operational_complexity: {
    primary: "Operational complexity narrative — emphasize multi-location dispatch, asset visibility, and standardized PM execution.",
    secondary: "Highlight coordination across sites without claiming specific location count unless verified.",
  },
  growth: {
    primary: "Growth narrative — emphasize contract expansion, customer retention, and installed-base coverage.",
    secondary: "Connect service execution quality to renewal and expansion conversations.",
  },
  general: {
    primary: "General relevance narrative — lead with likely industry patterns and invite discovery.",
    secondary: "Keep company-specific claims minimal until verified facts support them.",
  },
}

function detectMultiLocation(signals: string[]): boolean {
  return /\b(multi[- ]location|multiple locations|multi-site|campuses|branches|regions)\b/i.test(signals.join(" "))
}

function selectNarrativeType(
  themes: GrowthPlaybookSelectionTheme[],
  signals: string[],
): GrowthNarrativeType {
  if (themes.includes("compliance")) return "compliance"
  if (themes.includes("financial")) return "financial"
  if (themes.includes("scaling")) return "scaling"
  if (themes.includes("pm")) return "workflow"
  if (themes.includes("dispatch") && detectMultiLocation(signals)) return "operational_complexity"
  if (themes.includes("growth")) return "growth"
  if (themes.includes("dispatch")) return "workflow"
  return "general"
}

function selectLeadWith(narrativeType: GrowthNarrativeType): GrowthNarrativeLeadWith {
  switch (narrativeType) {
    case "compliance":
      return "compliance"
    case "financial":
      return "financial_pain"
    case "scaling":
    case "growth":
      return "growth_pain"
    case "operational_complexity":
    case "workflow":
      return "operational_pain"
    default:
      return "operational_pain"
  }
}

function selectTone(
  personaTitle: string | null | undefined,
  decisionMakerTitle: string | null | undefined,
  narrativeType: GrowthNarrativeType,
): GrowthNarrativeTone {
  const title = `${decisionMakerTitle ?? ""} ${personaTitle ?? ""}`.toLowerCase()
  if (/\b(owner|president|ceo|founder|chief)\b/.test(title)) return "executive"
  if (/\b(operations director|general manager|vp)\b/.test(title)) return "advisory"
  if (/\b(compliance|htm|quality|clinical engineering|regulatory)\b/.test(title)) return "technical"
  if (/\b(service manager|dispatch|field supervisor|field service)\b/.test(title)) return "operational"
  if (narrativeType === "compliance") return "technical"
  if (narrativeType === "financial") return "consultative"
  return "consultative"
}

function computeCompanyVsIndustryRatio(verifiedFacts: string[]): GrowthNarrativeCompanyVsIndustryRatio {
  const count = verifiedFacts.map((entry) => entry.trim()).filter(Boolean).length
  if (count >= 3) {
    return {
      companyPercent: 70,
      industryPercent: 30,
      rationale: "Rich verified company context — lead with company-specific observations, use industry patterns for relevance.",
    }
  }
  if (count === 2) {
    return {
      companyPercent: 50,
      industryPercent: 50,
      rationale: "Moderate verified context — balance company observations with industry relevance.",
    }
  }
  return {
    companyPercent: 20,
    industryPercent: 80,
    rationale: "Limited verified company context — emphasize industry intelligence; keep company claims conservative.",
  }
}

function buildNarrativeGoals(
  ratio: GrowthNarrativeCompanyVsIndustryRatio,
  leadWith: GrowthNarrativeLeadWith,
): string[] {
  return [
    `Weight company vs industry context approximately ${ratio.companyPercent}% / ${ratio.industryPercent}%.`,
    `Lead with ${leadWith.replace(/_/g, " ")} themes using consultative language.`,
    "Never claim unverified company-specific pain or events.",
    "Use industry phrasing like 'teams in this space often…' for non-verified patterns.",
    "Close with a low-pressure, discovery-oriented CTA.",
  ]
}

export function buildGrowthNarrativeContextFromInput(input: GrowthNarrativeContextInput): GrowthNarrativeContext {
  const themes = input.activeThemes?.length ? input.activeThemes : (["general"] as GrowthPlaybookSelectionTheme[])
  const signals = input.leadSignals ?? []
  const narrativeType = selectNarrativeType(themes, signals)
  const descriptions = NARRATIVE_DESCRIPTIONS[narrativeType]
  const primaryPain = input.selectedPains?.[0]?.replace(/\.$/, "") ?? null
  const capability = input.selectedCapabilities?.[0] ?? null
  const persona = input.primaryPersona ?? null
  const verifiedFacts = input.verifiedFacts ?? []
  const ratio = computeCompanyVsIndustryRatio(verifiedFacts)
  const leadWith = selectLeadWith(narrativeType)
  const tone = selectTone(persona?.title, input.decisionMakerTitle, narrativeType)

  const primaryNarrative = primaryPain
    ? `${descriptions.primary} Anchor theme: ${primaryPain}.`
    : descriptions.primary
  const secondaryNarrative = descriptions.secondary

  const recommendedProof = capability
    ? `Highlight ${capability.capability} for ${capability.painSignal.toLowerCase()} — Equipify ${capability.equipifyModule}.`
    : null

  return {
    primaryNarrative,
    secondaryNarrative,
    narrativeType,
    buyerPersona: persona,
    secondaryBuyerPersona: input.secondaryPersona ?? null,
    leadWith,
    recommendedTone: tone,
    narrativeGoals: buildNarrativeGoals(ratio, leadWith),
    recommendedOpening: OPENING_TEMPLATES[narrativeType],
    recommendedProof,
    recommendedCTA: input.primaryCta ?? null,
    objectionAwareness: (input.selectedObjections ?? []).slice(0, 3),
    companyVsIndustryRatio: ratio,
    activeThemes: themes,
  }
}

export function buildGrowthNarrativeContext(input: {
  industryContext: GrowthIndustryContext
  leadSignals?: string[]
  decisionMakerTitle?: string | null
}): GrowthNarrativeContext | null {
  if (!input.industryContext.playbookApplied || !input.industryContext.playbookContext) {
    return null
  }

  const playbookContext = input.industryContext.playbookContext
  return buildGrowthNarrativeContextFromInput({
    verifiedFacts: input.industryContext.verifiedFacts,
    playbookDisplayName: input.industryContext.playbook?.displayName ?? null,
    activeThemes: playbookContext.activeThemes,
    selectedPains: playbookContext.selectedPains,
    selectedCapabilities: playbookContext.selectedCapabilities,
    primaryPersona: playbookContext.primaryPersona,
    secondaryPersona: playbookContext.secondaryPersona,
    primaryCta: playbookContext.primaryCta,
    selectedObjections: playbookContext.selectedObjections,
    leadSignals: input.leadSignals,
    decisionMakerTitle: input.decisionMakerTitle,
  })
}
