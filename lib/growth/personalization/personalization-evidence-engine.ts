import {
  sanitizePersonalizationEvidenceSnippet,
  type GrowthPersonalizationContext,
  type GrowthPersonalizationEvidence,
  type GrowthPersonalizationSource,
} from "@/lib/growth/personalization/personalization-types"

export type PersonalizationEvidenceCandidate = {
  sourceType: GrowthPersonalizationSource
  claimKey: string
  evidenceSnippet: string
  confidence: "low" | "medium" | "high" | "verified"
}

export function buildPersonalizationEvidenceFromContext(
  context: GrowthPersonalizationContext,
): PersonalizationEvidenceCandidate[] {
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

export function computeEvidenceCoverageScore(candidates: PersonalizationEvidenceCandidate[]): number {
  const sourceCount = new Set(candidates.map((entry) => entry.sourceType)).size
  const depth = Math.min(50, candidates.length * 8)
  const breadth = Math.min(50, sourceCount * 10)
  return Math.min(100, Math.round(depth + breadth))
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
