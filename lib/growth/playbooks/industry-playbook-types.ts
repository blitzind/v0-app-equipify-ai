/** GS-AI-PLAYBOOK-1A/2A — Industry playbook schema (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"

export const GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER = "growth-industry-playbook-foundation-gs-ai-playbook-1a-v1" as const

export const GROWTH_INDUSTRY_PLAYBOOK_ENRICHMENT_QA_MARKER =
  "growth-industry-playbook-enrichment-gs-ai-playbook-2a-v1" as const

export type GrowthIndustryPlaybookEnrichmentLevel = "seed" | "moderate" | "reference"

export type GrowthIndustryPlaybookCapabilityMapping = {
  capability: string
  painSignal: string
  equipifyModule: string
}

export type GrowthIndustryPlaybookStoryline = {
  title: string
  hook: string
  audience: string
  theme?: string
}

export type GrowthIndustryPlaybookBuyerPersona = {
  title: string
  goals: string[]
  kpis: string[]
  frustrations: string[]
  buyingTriggers: string[]
  commonObjections: string[]
  successMetrics: string[]
}

export type GrowthIndustryPlaybookStructuredObjection = {
  objection: string
  recommendedResponse: string
  recommendedDiscoveryQuestion: string
}

export type GrowthIndustryPlaybookCompetitorProfile = {
  competitor: string
  strengths: string[]
  weaknesses: string[]
  migrationOpportunities: string[]
}

export type GrowthIndustryPlaybookImplementationAngle = {
  title: string
  description: string
  equipifyModules: string[]
}

export type GrowthIndustryPlaybookTransformationStory = {
  title: string
  before: string
  after: string
  audience: string
}

export type GrowthIndustryPlaybook = {
  id: string
  industryId: GrowthIndustryId
  displayName: string
  overview: string
  pains: string[]
  discoveryQuestions: string[]
  objections: string[]
  proofPoints: string[]
  capabilityMappings: GrowthIndustryPlaybookCapabilityMapping[]
  videoStorylines: GrowthIndustryPlaybookStoryline[]
  sharePageStorylines: GrowthIndustryPlaybookStoryline[]
  recommendedCtas: string[]
  keywords: string[]
  /** GS-AI-PLAYBOOK-2A — optional enrichment fields (backward compatible). */
  enrichmentLevel?: GrowthIndustryPlaybookEnrichmentLevel
  operationalPains?: string[]
  financialPains?: string[]
  buyerPersonas?: GrowthIndustryPlaybookBuyerPersona[]
  implementationAngles?: GrowthIndustryPlaybookImplementationAngle[]
  transformationStories?: GrowthIndustryPlaybookTransformationStory[]
  structuredObjections?: GrowthIndustryPlaybookStructuredObjection[]
  competitiveLandscape?: GrowthIndustryPlaybookCompetitorProfile[]
  personalizationOpeners?: string[]
  industryVocabulary?: string[]
  industryMetrics?: string[]
  industryTriggers?: string[]
  successSignals?: string[]
  warningSignals?: string[]
  storylines?: GrowthIndustryPlaybookStoryline[]
}

export type GrowthIndustryPlaybookEnrichmentInput = {
  industryId: GrowthIndustryId
  overview: string
  operationalPains: string[]
  financialPains: string[]
  discoveryQuestions: string[]
  proofPoints: string[]
  capabilityMappings: GrowthIndustryPlaybookCapabilityMapping[]
  recommendedCtas: string[]
  buyerPersonas: GrowthIndustryPlaybookBuyerPersona[]
  structuredObjections: GrowthIndustryPlaybookStructuredObjection[]
  storylines: GrowthIndustryPlaybookStoryline[]
  successSignals: string[]
  warningSignals: string[]
  personalizationOpeners: string[]
  industryVocabulary: string[]
  industryMetrics: string[]
  industryTriggers: string[]
  implementationAngles?: GrowthIndustryPlaybookImplementationAngle[]
  transformationStories?: GrowthIndustryPlaybookTransformationStory[]
  competitiveLandscape?: GrowthIndustryPlaybookCompetitorProfile[]
  videoStorylines?: GrowthIndustryPlaybookStoryline[]
  sharePageStorylines?: GrowthIndustryPlaybookStoryline[]
  objections?: string[]
  keywords?: string[]
}

export type GrowthIndustryPlaybookValidationIssue = {
  path: string
  message: string
}

const LEGACY_MIN = 3
const LEGACY_MAX = 12

const REFERENCE_MINIMUMS = {
  operationalPains: 15,
  financialPains: 10,
  buyerPersonas: 5,
  discoveryQuestions: 20,
  proofPoints: 10,
  capabilityMappings: 15,
  recommendedCtas: 15,
  storylines: 15,
  structuredObjections: 15,
  successSignals: 15,
  warningSignals: 10,
  personalizationOpeners: 8,
  industryVocabulary: 10,
  industryMetrics: 8,
  industryTriggers: 8,
} as const

function countIssues(
  items: string[],
  path: string,
  issues: GrowthIndustryPlaybookValidationIssue[],
  min: number,
  max: number,
): void {
  const filled = items.map((entry) => entry.trim()).filter(Boolean)
  if (filled.length < min) {
    issues.push({ path, message: `Expected at least ${min} items, got ${filled.length}` })
  }
  if (filled.length > max) {
    issues.push({ path, message: `Expected at most ${max} items, got ${filled.length}` })
  }
}

function countMin<T>(
  items: T[] | undefined,
  path: string,
  min: number,
  issues: GrowthIndustryPlaybookValidationIssue[],
): void {
  const length = items?.length ?? 0
  if (length < min) {
    issues.push({ path, message: `Expected at least ${min} items, got ${length}` })
  }
}

function validateReferencePlaybook(playbook: GrowthIndustryPlaybook): GrowthIndustryPlaybookValidationIssue[] {
  const issues: GrowthIndustryPlaybookValidationIssue[] = []

  countMin(playbook.operationalPains, "operationalPains", REFERENCE_MINIMUMS.operationalPains, issues)
  countMin(playbook.financialPains, "financialPains", REFERENCE_MINIMUMS.financialPains, issues)
  countMin(playbook.buyerPersonas, "buyerPersonas", REFERENCE_MINIMUMS.buyerPersonas, issues)
  countIssues(playbook.discoveryQuestions, "discoveryQuestions", issues, REFERENCE_MINIMUMS.discoveryQuestions, 30)
  countIssues(playbook.proofPoints, "proofPoints", issues, REFERENCE_MINIMUMS.proofPoints, 25)
  countIssues(playbook.recommendedCtas, "recommendedCtas", issues, REFERENCE_MINIMUMS.recommendedCtas, 25)
  countMin(playbook.storylines, "storylines", REFERENCE_MINIMUMS.storylines, issues)
  countMin(playbook.structuredObjections, "structuredObjections", REFERENCE_MINIMUMS.structuredObjections, issues)
  countMin(playbook.successSignals, "successSignals", REFERENCE_MINIMUMS.successSignals, issues)
  countMin(playbook.warningSignals, "warningSignals", REFERENCE_MINIMUMS.warningSignals, issues)
  countMin(playbook.personalizationOpeners, "personalizationOpeners", REFERENCE_MINIMUMS.personalizationOpeners, issues)
  countMin(playbook.industryVocabulary, "industryVocabulary", REFERENCE_MINIMUMS.industryVocabulary, issues)
  countMin(playbook.industryMetrics, "industryMetrics", REFERENCE_MINIMUMS.industryMetrics, issues)
  countMin(playbook.industryTriggers, "industryTriggers", REFERENCE_MINIMUMS.industryTriggers, issues)
  countMin(
    playbook.capabilityMappings,
    "capabilityMappings",
    REFERENCE_MINIMUMS.capabilityMappings,
    issues,
  )

  countIssues(playbook.pains, "pains", issues, LEGACY_MIN, LEGACY_MAX)
  countIssues(playbook.keywords, "keywords", issues, LEGACY_MIN, LEGACY_MAX)

  for (const [index, persona] of (playbook.buyerPersonas ?? []).entries()) {
    if (!persona.title.trim()) issues.push({ path: `buyerPersonas[${index}].title`, message: "title required" })
    for (const field of ["goals", "kpis", "frustrations", "buyingTriggers", "commonObjections", "successMetrics"] as const) {
      if ((persona[field]?.length ?? 0) < 2) {
        issues.push({ path: `buyerPersonas[${index}].${field}`, message: "Expected at least 2 entries" })
      }
    }
  }

  for (const [index, objection] of (playbook.structuredObjections ?? []).entries()) {
    if (!objection.objection.trim() || !objection.recommendedResponse.trim()) {
      issues.push({ path: `structuredObjections[${index}]`, message: "objection and response required" })
    }
  }

  return issues
}

export function validateGrowthIndustryPlaybook(
  playbook: GrowthIndustryPlaybook,
): GrowthIndustryPlaybookValidationIssue[] {
  const issues: GrowthIndustryPlaybookValidationIssue[] = []

  if (!playbook.id.trim()) issues.push({ path: "id", message: "id is required" })
  if (!playbook.industryId.trim()) issues.push({ path: "industryId", message: "industryId is required" })
  if (playbook.id !== playbook.industryId) {
    issues.push({ path: "id", message: "id must match industryId for seeded playbooks" })
  }
  if (!playbook.displayName.trim()) issues.push({ path: "displayName", message: "displayName is required" })
  if (!playbook.overview.trim()) issues.push({ path: "overview", message: "overview is required" })

  if (playbook.enrichmentLevel === "reference") {
    issues.push(...validateReferencePlaybook(playbook))
  } else {
    countIssues(playbook.pains, "pains", issues, LEGACY_MIN, LEGACY_MAX)
    countIssues(playbook.discoveryQuestions, "discoveryQuestions", issues, LEGACY_MIN, LEGACY_MAX)
    countIssues(playbook.proofPoints, "proofPoints", issues, LEGACY_MIN, LEGACY_MAX)
    countIssues(playbook.recommendedCtas, "recommendedCtas", issues, LEGACY_MIN, LEGACY_MAX)
    countIssues(playbook.keywords, "keywords", issues, LEGACY_MIN, LEGACY_MAX)
    if (playbook.objections.length > LEGACY_MAX) {
      issues.push({ path: "objections", message: `Too many objections (${playbook.objections.length})` })
    }
  }

  for (const [index, mapping] of playbook.capabilityMappings.entries()) {
    if (!mapping.capability.trim() || !mapping.painSignal.trim() || !mapping.equipifyModule.trim()) {
      issues.push({ path: `capabilityMappings[${index}]`, message: "All mapping fields are required" })
    }
  }

  for (const [index, storyline] of [...playbook.videoStorylines, ...playbook.sharePageStorylines].entries()) {
    if (!storyline.title.trim() || !storyline.hook.trim()) {
      issues.push({ path: `storyline[${index}]`, message: "Storyline title and hook are required" })
    }
  }

  return issues
}

export function assertValidGrowthIndustryPlaybook(playbook: GrowthIndustryPlaybook): void {
  const issues = validateGrowthIndustryPlaybook(playbook)
  if (issues.length > 0) {
    throw new Error(
      `Invalid playbook ${playbook.id}: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    )
  }
}

export function isReferenceEnrichedPlaybook(playbook: GrowthIndustryPlaybook): boolean {
  return playbook.enrichmentLevel === "reference"
}
