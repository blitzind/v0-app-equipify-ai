/** GS-AI-PLAYBOOK-3C — Outcome guidance engine (client-safe). */

import {
  analyzeGrowthPlaybookOutcomes,
  bottomPerformingOutcomePatterns,
  topPerformingOutcomeValues,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-analyzer"
import {
  getPersonaCtaLabel,
  getPersonaProofLabel,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-frameworks"
import type {
  GrowthPersonaArchetype,
  GrowthPersonaCtaType,
  GrowthPersonaProofType,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type {
  GrowthPlaybookRankedCta,
  GrowthPlaybookRankedStoryline,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import type { GrowthIndustryPlaybookCapabilityMapping } from "@/lib/growth/playbooks/industry-playbook-types"
import {
  inferOutcomeCtaType,
  inferOutcomeProofType,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-builder"
import {
  GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS,
  type GrowthPlaybookOutcomeGuidance,
  type GrowthPlaybookOutcomeGuidanceConfidence,
  type GrowthPlaybookOutcomeGuidanceInput,
  type GrowthPlaybookOutcomeNarrativeType,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"

const OUTCOME_GUIDANCE_BOOST = 14
const OUTCOME_GUIDANCE_DEPRIORITIZE = -12

const WINNING_PATTERN_LIBRARY: Array<{
  industryIds: string[]
  personaArchetypes: GrowthPersonaArchetype[]
  preferredProofTypes: GrowthPersonaProofType[]
  preferredCtaTypes: GrowthPersonaCtaType[]
  preferredNarratives: GrowthPlaybookOutcomeNarrativeType[]
  avoidPatterns: string[]
  winningLabels: string[]
}> = [
  {
    industryIds: ["biomedical_equipment", "medical_equipment", "calibration_inspection"],
    personaArchetypes: ["htm_director", "compliance_manager"],
    preferredProofTypes: ["compliance", "audit_readiness", "pm_completion"],
    preferredCtaTypes: ["workflow_walkthrough", "compliance_review", "operational_review"],
    preferredNarratives: ["operational"],
    avoidPatterns: ["Generic demos", "Technical feature dumps"],
    winningLabels: ["Workflow review CTAs", "Compliance proof", "Operational narratives"],
  },
  {
    industryIds: ["hvac_r", "commercial_hvac", "field_service", "electrical", "plumbing"],
    personaArchetypes: ["owner"],
    preferredProofTypes: ["revenue_growth", "profitability", "labor_savings"],
    preferredCtaTypes: ["strategic_review", "roi_discussion"],
    preferredNarratives: ["financial"],
    avoidPatterns: ["Generic demos", "Dispatch-only feature lists"],
    winningLabels: ["ROI proof", "Strategic review CTAs", "Financial narratives"],
  },
  {
    industryIds: ["field_service", "hvac_r", "commercial_hvac", "facility_maintenance"],
    personaArchetypes: ["service_manager", "dispatcher"],
    preferredProofTypes: ["technician_productivity", "faster_scheduling", "reduced_callbacks"],
    preferredCtaTypes: ["dispatch_demonstration", "workflow_walkthrough", "scheduling_walkthrough"],
    preferredNarratives: ["operational"],
    avoidPatterns: ["Generic demos", "Executive ROI-only framing"],
    winningLabels: ["Dispatch storyline", "Workflow walkthrough CTAs", "Productivity proof"],
  },
]

function resolveConfidence(
  sampleSize: number,
  thresholds: typeof GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS,
): GrowthPlaybookOutcomeGuidanceConfidence {
  if (sampleSize >= thresholds.high) return "high"
  if (sampleSize >= thresholds.medium) return "medium"
  if (sampleSize >= thresholds.low) return "low"
  return "low"
}

function findLibraryPattern(input: {
  industryId?: string | null
  personaArchetype?: GrowthPersonaArchetype | null
}) {
  if (!input.industryId && !input.personaArchetype) return null
  return (
    WINNING_PATTERN_LIBRARY.find(
      (entry) =>
        (!input.industryId || entry.industryIds.includes(input.industryId)) &&
        (!input.personaArchetype || entry.personaArchetypes.includes(input.personaArchetype)),
    ) ?? null
  )
}

export function buildGrowthPlaybookOutcomeGuidance(
  input: GrowthPlaybookOutcomeGuidanceInput,
): GrowthPlaybookOutcomeGuidance {
  const thresholds = { ...GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS, ...input.sampleThresholds }
  const analysis = analyzeGrowthPlaybookOutcomes({
    records: input.records,
    filter: input.filter,
  })

  const library = findLibraryPattern({
    industryId: input.filter?.industryId ?? null,
    personaArchetype: input.filter?.personaArchetype ?? null,
  })

  const topProof = topPerformingOutcomeValues(
    analysis.segments,
    "proof",
    (segment) => segment.proofType,
    "approvalRate",
    thresholds.low,
  )
  const topCta = topPerformingOutcomeValues(
    analysis.segments,
    "cta",
    (segment) => segment.ctaType,
    "replyRate",
    thresholds.low,
  )
  const topNarrative = topPerformingOutcomeValues(
    analysis.segments,
    "narrative",
    (segment) => segment.narrativeType,
    "meetingRate",
    thresholds.low,
  )

  const preferredProofTypes = [
    ...topProof.map((entry) => entry.value),
    ...(library?.preferredProofTypes ?? []),
  ].filter((value, index, array): value is GrowthPersonaProofType => Boolean(value) && array.indexOf(value) === index)

  const preferredCtaTypes = [
    ...topCta.map((entry) => entry.value),
    ...(library?.preferredCtaTypes ?? []),
  ].filter((value, index, array): value is GrowthPersonaCtaType => Boolean(value) && array.indexOf(value) === index)

  const preferredNarratives = [
    ...topNarrative.map((entry) => entry.value),
    ...(library?.preferredNarratives ?? []),
  ].filter(
    (value, index, array): value is GrowthPlaybookOutcomeNarrativeType =>
      Boolean(value) && array.indexOf(value) === index,
  )

  const avoidPatterns = [
    ...bottomPerformingOutcomePatterns(analysis.segments, thresholds.low),
    ...(library?.avoidPatterns ?? []),
    "Generic demos",
    "Technical feature dumps",
  ].filter((value, index, array) => array.indexOf(value) === index)

  const sampleSize = analysis.overall.sampleSize
  const confidence = resolveConfidence(sampleSize, thresholds)

  return {
    preferredProofTypes: preferredProofTypes.slice(0, 5),
    preferredCtaTypes: preferredCtaTypes.slice(0, 5),
    preferredNarratives: preferredNarratives.slice(0, 3),
    avoidPatterns: avoidPatterns.slice(0, 6),
    confidence: library && sampleSize < thresholds.low ? "medium" : confidence,
    sampleSize,
    freshnessDays: analysis.overall.freshnessDays,
  }
}

function ctaMatchesPreferredType(cta: string, preferred: GrowthPersonaCtaType[]): number {
  const inferred = inferOutcomeCtaType(cta)
  if (!inferred) return 0
  const index = preferred.indexOf(inferred)
  if (index === 0) return OUTCOME_GUIDANCE_BOOST
  if (index > 0) return Math.max(6, OUTCOME_GUIDANCE_BOOST - index * 2)
  if (/\bdemo\b/i.test(cta)) return OUTCOME_GUIDANCE_DEPRIORITIZE
  return 0
}

function capabilityMatchesPreferredProof(
  capability: GrowthIndustryPlaybookCapabilityMapping,
  preferred: GrowthPersonaProofType[],
): number {
  const inferred = inferOutcomeProofType({
    capabilityText: `${capability.capability} ${capability.painSignal} ${capability.equipifyModule}`,
  })
  if (!inferred) return 0
  const index = preferred.indexOf(inferred)
  if (index === 0) return OUTCOME_GUIDANCE_BOOST
  if (index > 0) return Math.max(6, OUTCOME_GUIDANCE_BOOST - index * 2)
  return 0
}

function storylineMatchesPreferredNarrative(
  storyline: GrowthPlaybookRankedStoryline,
  preferred: GrowthPlaybookOutcomeNarrativeType[],
): number {
  const index = preferred.indexOf(storyline.category)
  if (index === 0) return OUTCOME_GUIDANCE_BOOST
  if (index > 0) return Math.max(6, OUTCOME_GUIDANCE_BOOST - index * 2)
  return 0
}

export function applyOutcomeGuidanceToRankedCtas(
  rankedCtas: GrowthPlaybookRankedCta[],
  guidance: GrowthPlaybookOutcomeGuidance | null | undefined,
): { rankedCtas: GrowthPlaybookRankedCta[]; boosts: string[]; deprioritized: string[] } {
  if (!guidance || guidance.sampleSize < GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS.low) {
    return { rankedCtas, boosts: [], deprioritized: [] }
  }

  const boosts: string[] = []
  const deprioritized: string[] = []

  const rescored = rankedCtas
    .map((entry, index) => {
      const delta = ctaMatchesPreferredType(entry.cta, guidance.preferredCtaTypes)
      if (delta > 0) boosts.push(`CTA boost: ${entry.cta.slice(0, 60)}`)
      if (delta < 0) deprioritized.push(`CTA deprioritized: ${entry.cta.slice(0, 60)}`)
      return { entry, score: delta - index * 0.01 }
    })
    .sort((a, b) => b.score - a.score || a.entry.cta.localeCompare(b.entry.cta))
    .map((row, index) => ({
      ...row.entry,
      rank: (index === 0 ? "primary" : index === 1 ? "secondary" : "tertiary") as GrowthPlaybookRankedCta["rank"],
    }))

  return { rankedCtas: rescored, boosts: [...new Set(boosts)], deprioritized: [...new Set(deprioritized)] }
}

export function applyOutcomeGuidanceToRankedStorylines(
  rankedStorylines: GrowthPlaybookRankedStoryline[],
  guidance: GrowthPlaybookOutcomeGuidance | null | undefined,
): { rankedStorylines: GrowthPlaybookRankedStoryline[]; boosts: string[]; deprioritized: string[] } {
  if (!guidance || guidance.sampleSize < GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS.low) {
    return { rankedStorylines, boosts: [], deprioritized: [] }
  }

  const boosts: string[] = []
  const deprioritized: string[] = []

  const rescored = rankedStorylines
    .map((entry, index) => {
      const delta = storylineMatchesPreferredNarrative(entry, guidance.preferredNarratives)
      if (delta > 0) boosts.push(`Storyline boost: ${entry.storyline.title}`)
      if (delta < 0) deprioritized.push(`Storyline deprioritized: ${entry.storyline.title}`)
      return { entry, score: delta - index * 0.01 }
    })
    .sort((a, b) => b.score - a.score || a.entry.storyline.title.localeCompare(b.entry.storyline.title))
    .map((row) => row.entry)

  return { rankedStorylines: rescored, boosts: [...new Set(boosts)], deprioritized: [...new Set(deprioritized)] }
}

export function applyOutcomeGuidanceToCapabilities(
  capabilities: GrowthIndustryPlaybookCapabilityMapping[],
  guidance: GrowthPlaybookOutcomeGuidance | null | undefined,
): { capabilities: GrowthIndustryPlaybookCapabilityMapping[]; boosts: string[]; deprioritized: string[] } {
  if (!guidance || guidance.sampleSize < GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS.low) {
    return { capabilities, boosts: [], deprioritized: [] }
  }

  const boosts: string[] = []
  const deprioritized: string[] = []

  const rescored = capabilities
    .map((entry, index) => {
      const delta = capabilityMatchesPreferredProof(entry, guidance.preferredProofTypes)
      if (delta > 0) boosts.push(`Proof boost: ${entry.capability}`)
      if (delta < 0) deprioritized.push(`Proof deprioritized: ${entry.capability}`)
      return { entry, score: delta - index * 0.01 }
    })
    .sort((a, b) => b.score - a.score || a.entry.capability.localeCompare(b.entry.capability))
    .map((row) => row.entry)

  return { capabilities: rescored, boosts: [...new Set(boosts)], deprioritized: [...new Set(deprioritized)] }
}

export function buildOutcomeGuidanceWinningPatternLabels(
  guidance: GrowthPlaybookOutcomeGuidance,
  filter?: GrowthPlaybookOutcomeGuidanceInput["filter"],
): string[] {
  const library = findLibraryPattern({
    industryId: filter?.industryId ?? null,
    personaArchetype: filter?.personaArchetype ?? null,
  })
  const labels = library?.winningLabels ?? []
  const computed = [
    ...guidance.preferredCtaTypes.slice(0, 2).map((type) => getPersonaCtaLabel(type)),
    ...guidance.preferredProofTypes.slice(0, 2).map((type) => getPersonaProofLabel(type)),
    ...guidance.preferredNarratives.map((type) => `${type} narratives`),
  ]
  return [...new Set([...labels, ...computed])].slice(0, 6)
}
