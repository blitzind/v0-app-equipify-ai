/** GS-AI-PLAYBOOK-2A — Enriched playbook builder (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type {
  GrowthIndustryPlaybook,
  GrowthIndustryPlaybookEnrichmentInput,
} from "@/lib/growth/playbooks/industry-playbook-types"
import { GROWTH_INDUSTRY_PLAYBOOK_ENRICHMENT_QA_MARKER } from "@/lib/growth/playbooks/industry-playbook-types"
import { getGrowthIndustryTaxonomyEntry } from "@/lib/growth/playbooks/industry-taxonomy"

function trimList(items: string[]): string[] {
  return items.map((entry) => entry.trim()).filter(Boolean)
}

function topItems(items: string[], max: number): string[] {
  return trimList(items).slice(0, max)
}

export function buildEnrichedIndustryPlaybook(
  input: GrowthIndustryPlaybookEnrichmentInput,
): GrowthIndustryPlaybook {
  const taxonomy = getGrowthIndustryTaxonomyEntry(input.industryId)
  const operationalPains = trimList(input.operationalPains)
  const financialPains = trimList(input.financialPains)
  const discoveryQuestions = trimList(input.discoveryQuestions)
  const proofPoints = trimList(input.proofPoints)
  const recommendedCtas = trimList(input.recommendedCtas)
  const videoStorylines = input.videoStorylines ?? []
  const storylines = input.storylines ?? videoStorylines

  return {
    id: input.industryId,
    industryId: input.industryId,
    displayName: taxonomy.label,
    overview: input.overview.trim(),
    pains: topItems([...operationalPains, ...financialPains], 12),
    discoveryQuestions,
    objections: trimList(input.objections ?? input.structuredObjections?.map((entry) => entry.objection) ?? []),
    proofPoints,
    capabilityMappings: input.capabilityMappings,
    videoStorylines: topItems(
      videoStorylines.map((entry) => `${entry.title} — ${entry.hook}`).length
        ? videoStorylines
        : storylines.slice(0, 3),
      12,
    ).map((entry) =>
      typeof entry === "string"
        ? { title: entry, hook: entry, audience: "Operations leader" }
        : entry,
    ),
    sharePageStorylines:
      input.sharePageStorylines ??
      storylines.slice(0, 3).map((entry) => ({
        title: entry.title,
        hook: entry.hook,
        audience: entry.audience,
      })),
    recommendedCtas,
    keywords: input.keywords ?? taxonomy.keywords,
    enrichmentLevel: "reference",
    operationalPains,
    financialPains,
    buyerPersonas: input.buyerPersonas,
    implementationAngles: input.implementationAngles,
    transformationStories: input.transformationStories,
    structuredObjections: input.structuredObjections,
    competitiveLandscape: input.competitiveLandscape,
    personalizationOpeners: input.personalizationOpeners,
    industryVocabulary: input.industryVocabulary,
    industryMetrics: input.industryMetrics,
    industryTriggers: input.industryTriggers,
    successSignals: input.successSignals,
    warningSignals: input.warningSignals,
    storylines,
  }
}

export { GROWTH_INDUSTRY_PLAYBOOK_ENRICHMENT_QA_MARKER }

export const GROWTH_INDUSTRY_PLAYBOOK_PRIORITY_ENRICHMENT_IDS = [
  "biomedical_equipment",
  "medical_equipment",
  "commercial_equipment",
  "industrial_equipment",
  "field_service",
  "calibration_inspection",
  "facility_maintenance",
  "commercial_hvac",
  "hvac_r",
  "commercial_kitchen",
] as const satisfies readonly GrowthIndustryId[]
