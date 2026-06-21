/** GS-AI-PLAYBOOK-1B — Industry playbook evidence (client-safe, industry-level only). */

import { resolveIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-registry"
import { GROWTH_INDUSTRY_TAXONOMY } from "@/lib/growth/playbooks/industry-taxonomy"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import type { PersonalizationEvidenceCandidate } from "@/lib/growth/personalization/personalization-evidence-engine"
import {
  sanitizePersonalizationEvidenceSnippet,
  type GrowthPersonalizationContext,
  type GrowthPersonalizationIndustryPlaybookDiagnostics,
  type GrowthPersonalizationSource,
} from "@/lib/growth/personalization/personalization-types"

export const GROWTH_PERSONALIZATION_INDUSTRY_PLAYBOOK_MIN_CONFIDENCE = 56

export const GROWTH_PERSONALIZATION_PLAYBOOK_SOURCE_TYPES = [
  "industry_playbook",
  "capability_mapping",
  "video_storyline",
] as const

export type GrowthPersonalizationPlaybookSource =
  (typeof GROWTH_PERSONALIZATION_PLAYBOOK_SOURCE_TYPES)[number]

export function isPersonalizationPlaybookSource(
  source: GrowthPersonalizationSource,
): source is GrowthPersonalizationPlaybookSource {
  return (GROWTH_PERSONALIZATION_PLAYBOOK_SOURCE_TYPES as readonly string[]).includes(source)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48)
}

function mapResolverConfidenceToEvidenceConfidence(
  resolverConfidence: number,
): PersonalizationEvidenceCandidate["confidence"] {
  if (resolverConfidence >= 90) return "high"
  if (resolverConfidence >= 76) return "medium"
  return "low"
}

function industryPlaybookPrefix(displayName: string): string {
  return `Industry playbook (${displayName}): teams in this space often`
}

export function buildIndustryPlaybookEvidenceBundle(context: GrowthPersonalizationContext): {
  candidates: PersonalizationEvidenceCandidate[]
  diagnostics: GrowthPersonalizationIndustryPlaybookDiagnostics | null
  sourcesUsed: GrowthPersonalizationSource[]
} {
  const { resolution, playbook } = resolveIndustryPlaybook({
    companyName: context.companyName,
    industry: context.industryLabel,
    description: context.companyDescription,
    websiteText: context.websiteSignals.join(" "),
    researchSummary: [context.companySummary, ...context.researchPainPoints, ...context.outreachAngles]
      .filter(Boolean)
      .join(" "),
    naics: context.naicsCodes.length ? context.naicsCodes : null,
    sic: context.sicCodes.length ? context.sicCodes : null,
  })

  if (
    !playbook ||
    !resolution.industryId ||
    resolution.confidence < GROWTH_PERSONALIZATION_INDUSTRY_PLAYBOOK_MIN_CONFIDENCE
  ) {
    return { candidates: [], diagnostics: null, sourcesUsed: [] }
  }

  const confidence = mapResolverConfidenceToEvidenceConfidence(resolution.confidence)
  const candidates = buildPlaybookEvidenceCandidates(playbook, confidence)
  const addedEvidenceLabels = collectPlaybookEvidenceLabels(playbook)

  const diagnostics: GrowthPersonalizationIndustryPlaybookDiagnostics = {
    resolvedIndustryId: resolution.industryId,
    resolvedIndustryLabel:
      GROWTH_INDUSTRY_TAXONOMY[resolution.industryId]?.label ?? playbook.displayName,
    resolverConfidence: resolution.confidence,
    matchedSignals: resolution.matchedSignals.map((signal) => signal.matchedValue).slice(0, 8),
    playbookDisplayName: playbook.displayName,
    playbookEvidenceCount: candidates.length,
    isIndustryLevelIntelligence: true,
    addedEvidenceLabels,
  }

  const sourcesUsed = [
    ...new Set(candidates.map((candidate) => candidate.sourceType)),
  ] as GrowthPersonalizationSource[]

  return { candidates, diagnostics, sourcesUsed }
}

function buildPlaybookEvidenceCandidates(
  playbook: GrowthIndustryPlaybook,
  confidence: PersonalizationEvidenceCandidate["confidence"],
): PersonalizationEvidenceCandidate[] {
  const candidates: PersonalizationEvidenceCandidate[] = []
  const prefix = industryPlaybookPrefix(playbook.displayName)

  const push = (
    sourceType: GrowthPersonalizationPlaybookSource,
    claimKey: string,
    snippet: string,
  ) => {
    const evidenceSnippet = sanitizePersonalizationEvidenceSnippet(snippet)
    if (evidenceSnippet.length < 8) return
    candidates.push({ sourceType, claimKey, evidenceSnippet, confidence })
  }

  for (const [index, pain] of playbook.pains.slice(0, 3).entries()) {
    push(
      "industry_playbook",
      `industry_playbook_pain_${index}`,
      `${prefix} manage ${pain.replace(/\.$/, "")}. (Industry-level relevance — not verified for this company.)`,
    )
  }

  for (const [index, mapping] of playbook.capabilityMappings.slice(0, 3).entries()) {
    push(
      "capability_mapping",
      `industry_playbook_capability_${slugify(mapping.capability) || index}`,
      `${prefix} address ${mapping.painSignal.toLowerCase()} via ${mapping.capability} — Equipify ${mapping.equipifyModule}. (Likely industry mapping, not a verified company fact.)`,
    )
  }

  for (const [index, question] of playbook.discoveryQuestions.slice(0, 2).entries()) {
    push(
      "industry_playbook",
      `industry_playbook_discovery_${index}`,
      `Industry playbook discovery angle (${playbook.displayName}): "${question}" — use as a likely relevance question, not a verified fact about this company.`,
    )
  }

  for (const [index, storyline] of playbook.videoStorylines.slice(0, 2).entries()) {
    push(
      "video_storyline",
      `industry_playbook_video_storyline_${index}`,
      `Industry playbook video storyline (${playbook.displayName}): "${storyline.title}" — ${storyline.hook} (Industry-level storyline, not company-specific.)`,
    )
  }

  return candidates
}

function collectPlaybookEvidenceLabels(playbook: GrowthIndustryPlaybook): string[] {
  return [
    ...playbook.pains.slice(0, 3),
    ...playbook.capabilityMappings.slice(0, 3).map((entry) => entry.capability),
    ...playbook.discoveryQuestions.slice(0, 2),
    ...playbook.videoStorylines.slice(0, 2).map((entry) => entry.title),
  ]
    .map((entry) => entry.trim())
    .filter(Boolean)
}
