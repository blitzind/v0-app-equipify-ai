/** GE-AIOS-SUPERVISED-SEQUENCE-RECOMMENDATION-HANDOFF-FIX-1F — Persist approved package sequence projection (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import {
  buildApprovedPackageSequenceProjectionReason,
  evaluateAvaOutreachPackageReadiness,
  GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
  GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
  leadHasCanonicalSequenceIntelligence,
  resolveApprovedPackageSequencePattern,
  type AvaOutreachPackageReadiness,
  type AvaOutreachSequenceReadinessSource,
} from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"

export type ApprovedPackageSequenceHandoffResult = {
  qa_marker: typeof GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER
  patternId: string
  patternKey: string
  sequenceConfidence: number
  confidenceSource: AvaOutreachSequenceReadinessSource
  provenanceVersion: typeof GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE
  readiness: AvaOutreachPackageReadiness
  preflightCode: string | null
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function evaluateAvaOutreachExecutionReadinessForPackage(
  admin: SupabaseClient,
  input: {
    leadId: string
    recommendedSequence: string | null | undefined
    recommendedChannel: string | null | undefined
  },
): Promise<AvaOutreachPackageReadiness> {
  const [lead, patterns] = await Promise.all([
    fetchGrowthLeadById(admin, input.leadId),
    listGrowthSequencePatterns(admin),
  ])

  return evaluateAvaOutreachPackageReadiness({
    recommendedSequence: input.recommendedSequence,
    recommendedChannel: input.recommendedChannel,
    leadRecommendedSequencePatternId: lead?.recommendedSequencePatternId,
    leadRecommendedSequenceConfidence: lead?.recommendedSequenceConfidence,
    sequenceFatigueRisk: lead?.sequenceFatigueRisk,
    patterns: patterns.map((pattern) => ({
      id: pattern.id,
      key: pattern.key,
      isActive: pattern.isActive,
      confidenceScore: pattern.confidenceScore,
    })),
  })
}

export async function ensureApprovedPackageSequenceHandoffForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    packageId: string
    recommendedSequence: string | null | undefined
    recommendedChannel: string | null | undefined
    executionRequestId?: string | null
    boundSequenceEnrollmentId?: string | null
  },
): Promise<ApprovedPackageSequenceHandoffResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const patterns = await listGrowthSequencePatterns(admin)
  const patternRefs = patterns.map((pattern) => ({
    id: pattern.id,
    key: pattern.key,
    isActive: pattern.isActive,
    confidenceScore: pattern.confidenceScore,
  }))

  const readiness = evaluateAvaOutreachPackageReadiness({
    recommendedSequence: input.recommendedSequence,
    recommendedChannel: input.recommendedChannel,
    leadRecommendedSequencePatternId: lead.recommendedSequencePatternId,
    leadRecommendedSequenceConfidence: lead.recommendedSequenceConfidence,
    sequenceFatigueRisk: lead.sequenceFatigueRisk,
    patterns: patternRefs,
  })

  if (!readiness.executionReady) {
    throw new Error(readiness.blockCode ?? "execution_not_ready")
  }

  let patternId = readiness.resolvedPatternId
  let patternKey = readiness.resolvedPatternKey
  let confidenceSource = readiness.confidenceSource
  let sequenceConfidence = readiness.sequenceConfidence ?? 0

  if (
    leadHasCanonicalSequenceIntelligence({
      recommendedSequencePatternId: lead.recommendedSequencePatternId,
      recommendedSequenceConfidence: lead.recommendedSequenceConfidence,
    })
  ) {
    patternId = lead.recommendedSequencePatternId
    patternKey =
      patterns.find((pattern) => pattern.id === lead.recommendedSequencePatternId)?.key ?? null
    confidenceSource = "lead_sequence_intelligence"
    sequenceConfidence = lead.recommendedSequenceConfidence ?? 0
  } else {
    const resolved = resolveApprovedPackageSequencePattern({
      recommendedSequence: input.recommendedSequence,
      recommendedChannel: input.recommendedChannel,
      patterns: patternRefs,
    })
    if (!resolved.patternId || !resolved.patternKey) {
      throw new Error("no_sequence_pattern")
    }
    patternId = resolved.patternId
    patternKey = resolved.patternKey
    confidenceSource = "approved_package_projection"
    sequenceConfidence = resolved.patternConfidence ?? 0

    const now = new Date().toISOString()
    const reason = buildApprovedPackageSequenceProjectionReason({
      recommendedSequence: input.recommendedSequence,
      patternKey: resolved.patternKey,
    })

    const { error } = await growthLeadsTable(admin)
      .update({
        recommended_sequence_pattern_id: resolved.patternId,
        recommended_sequence_reason: reason,
        recommended_sequence_confidence: sequenceConfidence,
        recommended_sequence_computed_at: now,
        recommended_sequence_next_step: lead.recommendedSequenceNextStep ?? {},
      })
      .eq("id", input.leadId)

    if (error) throw new Error(error.message)
  }

  if (!patternId || !patternKey) {
    throw new Error("no_sequence_pattern")
  }

  const refreshedLead = (await fetchGrowthLeadById(admin, input.leadId)) ?? lead
  const preflight = await runSequenceEnrollmentPreflight(admin, refreshedLead, {
    patternId,
    excludeEnrollmentId: input.boundSequenceEnrollmentId ?? null,
  })

  if (!preflight.allowed) {
    throw new Error(preflight.code ?? "preflight_blocked")
  }

  return {
    qa_marker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
    patternId,
    patternKey,
    sequenceConfidence,
    confidenceSource,
    provenanceVersion: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_PROVENANCE,
    readiness,
    preflightCode: null,
  }
}
