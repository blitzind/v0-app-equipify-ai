/** GE-AIOS-SUPERVISED-SEQUENCE-RECOMMENDATION-HANDOFF-FIX-1F — Approved package → sequence enrollment handoff (client-safe). */

export const GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER =
  "ge-aios-supervised-sequence-handoff-1f-v1" as const

export const GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE =
  "approved_package_recommended_sequence_v1" as const

/** Inverse of mapRevenueStrategySequenceToPackage — package cadence label → catalog pattern keys (priority order). */
export const GROWTH_AVA_APPROVED_PACKAGE_CADENCE_PATTERN_KEYS: Record<string, readonly string[]> = {
  phone_first_multichannel: ["call_then_email", "email_then_call"],
  linkedin_first_multichannel: ["cold_email_only", "email_then_call"],
  video_first_multichannel: ["email_then_call", "cold_email_only"],
  email_first_multichannel: ["email_then_call", "cold_email_only"],
} as const

export type AvaOutreachSequenceReadinessSource =
  | "lead_sequence_intelligence"
  | "approved_package_projection"
  | "unresolved"

export type AvaOutreachPackageReadiness = {
  qa_marker: typeof GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER
  approvalReady: boolean
  executionReady: boolean
  blockCode: string | null
  blockReason: string | null
  resolvedPatternKey: string | null
  resolvedPatternId: string | null
  sequenceConfidence: number | null
  confidenceSource: AvaOutreachSequenceReadinessSource
  recommendedCadence: string | null
  provenanceVersion: typeof GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE
}

export type AvaOutreachSequencePatternRef = {
  id: string
  key: string
  isActive: boolean
  confidenceScore?: number
}

function normalizeCadence(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function normalizeChannel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function mapApprovedPackageCadenceToPatternKeyCandidates(
  recommendedSequence: string | null | undefined,
  recommendedChannel: string | null | undefined,
): readonly string[] {
  const cadence = normalizeCadence(recommendedSequence)
  const channel = normalizeChannel(recommendedChannel)

  if (cadence) {
    if (cadence in GROWTH_AVA_APPROVED_PACKAGE_CADENCE_PATTERN_KEYS) {
      const keys = GROWTH_AVA_APPROVED_PACKAGE_CADENCE_PATTERN_KEYS[cadence]!
      if (cadence === "email_first_multichannel" && channel.includes("call")) {
        return ["email_then_call", "cold_email_only"]
      }
      return keys
    }
    return []
  }

  if (channel.includes("call")) return ["call_then_email", "email_then_call"]
  if (channel.includes("linkedin")) return ["cold_email_only", "email_then_call"]
  return ["email_then_call", "cold_email_only"]
}

export function resolveApprovedPackageSequencePattern(input: {
  recommendedSequence: string | null | undefined
  recommendedChannel: string | null | undefined
  patterns: AvaOutreachSequencePatternRef[]
}): { patternId: string | null; patternKey: string | null; patternConfidence: number | null } {
  const candidates = mapApprovedPackageCadenceToPatternKeyCandidates(
    input.recommendedSequence,
    input.recommendedChannel,
  )
  const active = input.patterns.filter((pattern) => pattern.isActive)
  for (const key of candidates) {
    const match = active.find((pattern) => pattern.key === key)
    if (match) {
      return {
        patternId: match.id,
        patternKey: match.key,
        patternConfidence:
          typeof match.confidenceScore === "number" ? match.confidenceScore : null,
      }
    }
  }
  return { patternId: null, patternKey: null, patternConfidence: null }
}

export function leadHasCanonicalSequenceIntelligence(input: {
  recommendedSequencePatternId?: string | null
  recommendedSequenceConfidence?: number | null
}): boolean {
  return Boolean(input.recommendedSequencePatternId) && (input.recommendedSequenceConfidence ?? 0) >= 40
}

export function evaluateAvaOutreachPackageReadiness(input: {
  recommendedSequence: string | null | undefined
  recommendedChannel: string | null | undefined
  leadRecommendedSequencePatternId?: string | null
  leadRecommendedSequenceConfidence?: number | null
  sequenceFatigueRisk?: string | null
  patterns?: AvaOutreachSequencePatternRef[]
}): AvaOutreachPackageReadiness {
  const recommendedCadence = input.recommendedSequence?.trim() || null

  if (input.sequenceFatigueRisk === "high") {
    return {
      qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      approvalReady: true,
      executionReady: false,
      blockCode: "fatigue_blocked",
      blockReason: "High sequence fatigue — pause before enrolling.",
      resolvedPatternKey: null,
      resolvedPatternId: null,
      sequenceConfidence: input.leadRecommendedSequenceConfidence ?? null,
      confidenceSource: "unresolved",
      recommendedCadence,
      provenanceVersion: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
    }
  }

  if (
    leadHasCanonicalSequenceIntelligence({
      recommendedSequencePatternId: input.leadRecommendedSequencePatternId,
      recommendedSequenceConfidence: input.leadRecommendedSequenceConfidence,
    })
  ) {
    return {
      qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      approvalReady: true,
      executionReady: true,
      blockCode: null,
      blockReason: null,
      resolvedPatternKey: null,
      resolvedPatternId: input.leadRecommendedSequencePatternId ?? null,
      sequenceConfidence: input.leadRecommendedSequenceConfidence ?? null,
      confidenceSource: "lead_sequence_intelligence",
      recommendedCadence,
      provenanceVersion: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
    }
  }

  const patterns = input.patterns ?? []
  const resolved = resolveApprovedPackageSequencePattern({
    recommendedSequence: input.recommendedSequence,
    recommendedChannel: input.recommendedChannel,
    patterns,
  })

  if (!resolved.patternId) {
    return {
      qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      approvalReady: true,
      executionReady: false,
      blockCode: "no_sequence_pattern",
      blockReason: input.patterns.length
        ? "No active sequence pattern matches the approved package cadence."
        : "Sequence pattern catalog unavailable — server validation required before Authorize.",
      resolvedPatternKey: null,
      resolvedPatternId: null,
      sequenceConfidence: null,
      confidenceSource: "unresolved",
      recommendedCadence,
      provenanceVersion: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
    }
  }

  return {
    qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
    approvalReady: true,
    executionReady: true,
    blockCode: null,
    blockReason: null,
    resolvedPatternKey: resolved.patternKey,
    resolvedPatternId: resolved.patternId,
    sequenceConfidence: resolved.patternConfidence,
    confidenceSource: "approved_package_projection",
    recommendedCadence,
    provenanceVersion: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
  }
}

export function buildApprovedPackageSequenceProjectionReason(input: {
  recommendedSequence: string | null | undefined
  patternKey: string
}): string {
  const cadence = input.recommendedSequence?.trim() || "email_first_multichannel"
  return `Approved outreach package cadence (${cadence}) → catalog pattern ${input.patternKey}`
}
