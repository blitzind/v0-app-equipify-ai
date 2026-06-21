/** GS-AI-PLAYBOOK-2A — Playbook audit utilities (client-safe). */

import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"

export type GrowthIndustryPlaybookPopulationTier = "reference" | "moderate" | "seed"

export type GrowthIndustryPlaybookAuditRow = {
  industryId: string
  displayName: string
  tier: GrowthIndustryPlaybookPopulationTier
  overviewChars: number
  pains: number
  operationalPains: number
  financialPains: number
  discoveryQuestions: number
  proofPoints: number
  capabilityMappings: number
  recommendedCtas: number
  videoStorylines: number
  storylines: number
  buyerPersonas: number
  structuredObjections: number
  successSignals: number
  warningSignals: number
  gaps: string[]
}

function hasEnrichmentFields(playbook: GrowthIndustryPlaybook): boolean {
  return Boolean(
    playbook.operationalPains?.length ||
      playbook.financialPains?.length ||
      playbook.buyerPersonas?.length ||
      playbook.structuredObjections?.length ||
      playbook.storylines?.length ||
      playbook.successSignals?.length,
  )
}

export function classifyPlaybookPopulationTier(
  playbook: GrowthIndustryPlaybook,
): GrowthIndustryPlaybookPopulationTier {
  if (playbook.enrichmentLevel === "reference") return "reference"
  if (playbook.enrichmentLevel === "moderate" || hasEnrichmentFields(playbook)) return "moderate"
  return "seed"
}

export function auditIndustryPlaybook(playbook: GrowthIndustryPlaybook): GrowthIndustryPlaybookAuditRow {
  const tier = classifyPlaybookPopulationTier(playbook)
  const gaps: string[] = []

  if (tier !== "reference") {
    if (playbook.pains.length < 5) gaps.push("Fewer than 5 pains")
    if (playbook.discoveryQuestions.length < 5) gaps.push("Fewer than 5 discovery questions")
    if (playbook.capabilityMappings.length < 3) gaps.push("Default capability mappings only")
    if (playbook.videoStorylines.length < 2) gaps.push("Limited storylines")
    if (playbook.recommendedCtas.length < 3) gaps.push("Generic CTAs")
    if (!playbook.buyerPersonas?.length) gaps.push("No buyer personas")
    if (!playbook.operationalPains?.length) gaps.push("No operational pain library")
  }

  return {
    industryId: playbook.industryId,
    displayName: playbook.displayName,
    tier,
    overviewChars: playbook.overview.length,
    pains: playbook.pains.length,
    operationalPains: playbook.operationalPains?.length ?? 0,
    financialPains: playbook.financialPains?.length ?? 0,
    discoveryQuestions: playbook.discoveryQuestions.length,
    proofPoints: playbook.proofPoints.length,
    capabilityMappings: playbook.capabilityMappings.length,
    recommendedCtas: playbook.recommendedCtas.length,
    videoStorylines: playbook.videoStorylines.length,
    storylines: playbook.storylines?.length ?? playbook.videoStorylines.length,
    buyerPersonas: playbook.buyerPersonas?.length ?? 0,
    structuredObjections: playbook.structuredObjections?.length ?? playbook.objections.length,
    successSignals: playbook.successSignals?.length ?? 0,
    warningSignals: playbook.warningSignals?.length ?? 0,
    gaps,
  }
}

export function auditIndustryPlaybookMatrix(
  playbooks: GrowthIndustryPlaybook[],
): GrowthIndustryPlaybookAuditRow[] {
  return playbooks.map(auditIndustryPlaybook).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function summarizePlaybookAuditMatrix(rows: GrowthIndustryPlaybookAuditRow[]): {
  reference: number
  moderate: number
  seed: number
} {
  return {
    reference: rows.filter((row) => row.tier === "reference").length,
    moderate: rows.filter((row) => row.tier === "moderate").length,
    seed: rows.filter((row) => row.tier === "seed").length,
  }
}
