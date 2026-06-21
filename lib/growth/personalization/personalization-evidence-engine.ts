import {
  buildIndustryPlaybookEvidenceBundle,
  isPersonalizationPlaybookSource,
} from "@/lib/growth/personalization/personalization-industry-playbook-evidence"
import {
  sanitizePersonalizationEvidenceSnippet,
  type GrowthPersonalizationContext,
  type GrowthPersonalizationEvidence,
  type GrowthPersonalizationIndustryPlaybookDiagnostics,
  type GrowthPersonalizationSource,
} from "@/lib/growth/personalization/personalization-types"

export type PersonalizationEvidenceCandidate = {
  sourceType: GrowthPersonalizationSource
  claimKey: string
  evidenceSnippet: string
  confidence: "low" | "medium" | "high" | "verified"
}

export type PersonalizationEvidenceBundle = {
  candidates: PersonalizationEvidenceCandidate[]
  industryPlaybookDiagnostics: GrowthPersonalizationIndustryPlaybookDiagnostics | null
}

const PLAYBOOK_DEPTH_POINTS = 4
const PLAYBOOK_DEPTH_CAP = 32
const PLAYBOOK_BREADTH_POINTS = 18
const PLAYBOOK_TOTAL_BONUS_CAP = 50
const VERIFIED_SCORE_LOW_CONTEXT_CAP = 65

function buildVerifiedEvidenceCandidates(context: GrowthPersonalizationContext): PersonalizationEvidenceCandidate[] {
  const candidates: PersonalizationEvidenceCandidate[] = []

  const push = (
    sourceType: GrowthPersonalizationSource,
    claimKey: string,
    snippet: string,
    confidence: PersonalizationEvidenceCandidate["confidence"] = "medium",
  ) => {
    const evidenceSnippet = sanitizePersonalizationEvidenceSnippet(snippet)
    if (evidenceSnippet.length < 8) return
    candidates.push({ sourceType, claimKey, evidenceSnippet, confidence })
  }

  if (context.relationshipSummary) {
    push("relationship_memory", "relationship_summary", context.relationshipSummary, "high")
  }
  if (context.relationshipStage) {
    push("relationship_memory", "relationship_stage", `Relationship stage: ${context.relationshipStage}`, "medium")
  }
  for (const entry of context.topObjections) push("relationship_memory", "objection", entry, "high")
  for (const entry of context.topPreferences) push("relationship_memory", "preference", entry, "medium")

  for (const entry of context.opportunitySignals) push("opportunity_intelligence", "opportunity_signal", entry, "high")
  for (const entry of context.bookingSignals) push("booking_intelligence", "booking_signal", entry, "high")
  for (const entry of context.buyingSignals) push("buying_signals", "buying_signal", entry, "high")
  for (const entry of context.committeeContext) push("committee_context", "committee_context", entry, "medium")
  for (const entry of context.companySignals) push("company_signals", "company_signal", entry, "medium")
  if (context.companySummary) push("company_signals", "company_summary", context.companySummary, "high")
  for (const entry of context.outreachAngles) push("website_intelligence", "outreach_angle", entry, "high")
  for (const entry of context.researchPainPoints) push("buying_signals", "research_pain_point", entry, "high")
  for (const entry of context.hiringSignals) push("buying_signals", "hiring_signal", entry, "medium")
  for (const entry of context.websiteSignals) push("website_intelligence", "website_signal", entry, "medium")
  if (context.territoryLabel) push("territory_intelligence", "territory", context.territoryLabel, "medium")
  if (context.engagementTier) push("engagement_history", "engagement_tier", `Engagement tier: ${context.engagementTier}`, "medium")
  for (const entry of context.inboxHistory) push("engagement_history", "inbox_history", entry, "medium")
  for (const entry of context.sequenceHistory) push("engagement_history", "sequence_history", entry, "low")

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.sourceType}:${candidate.claimKey}:${candidate.evidenceSnippet.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildPersonalizationEvidenceBundle(context: GrowthPersonalizationContext): PersonalizationEvidenceBundle {
  const verifiedCandidates = buildVerifiedEvidenceCandidates(context)
  const playbookBundle = buildIndustryPlaybookEvidenceBundle(context)

  const seen = new Set<string>()
  const candidates = [...verifiedCandidates, ...playbookBundle.candidates].filter((candidate) => {
    const key = `${candidate.sourceType}:${candidate.claimKey}:${candidate.evidenceSnippet.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    candidates,
    industryPlaybookDiagnostics: playbookBundle.diagnostics,
  }
}

export function buildPersonalizationEvidenceFromContext(
  context: GrowthPersonalizationContext,
): PersonalizationEvidenceCandidate[] {
  return buildPersonalizationEvidenceBundle(context).candidates
}

export function computeEvidenceCoverageScore(candidates: PersonalizationEvidenceCandidate[]): number {
  const verifiedCandidates = candidates.filter((entry) => !isPersonalizationPlaybookSource(entry.sourceType))
  const playbookCandidates = candidates.filter((entry) => isPersonalizationPlaybookSource(entry.sourceType))

  const verifiedSourceCount = new Set(verifiedCandidates.map((entry) => entry.sourceType)).size
  const verifiedDepth = Math.min(50, verifiedCandidates.length * 8)
  const verifiedBreadth = Math.min(50, verifiedSourceCount * 10)
  const verifiedScore = verifiedDepth + verifiedBreadth

  const playbookDepth = Math.min(PLAYBOOK_DEPTH_CAP, playbookCandidates.length * PLAYBOOK_DEPTH_POINTS)
  const playbookBreadth = playbookCandidates.length > 0 ? PLAYBOOK_BREADTH_POINTS : 0
  const playbookBonus = Math.min(PLAYBOOK_TOTAL_BONUS_CAP, playbookDepth + playbookBreadth)

  const combined = verifiedScore + playbookBonus
  if (verifiedScore < 30) {
    return Math.min(VERIFIED_SCORE_LOW_CONTEXT_CAP, Math.round(combined))
  }
  return Math.min(100, Math.round(combined))
}

export function mapEvidenceCandidatesToRecords(
  generationId: string,
  leadId: string,
  candidates: PersonalizationEvidenceCandidate[],
): Array<Omit<GrowthPersonalizationEvidence, "id"> & { generationId: string; leadId: string }> {
  return candidates.map((candidate) => ({
    generationId,
    leadId,
    sourceType: candidate.sourceType,
    claimKey: candidate.claimKey,
    evidenceSnippet: candidate.evidenceSnippet,
    confidence: candidate.confidence,
  }))
}
