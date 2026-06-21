/** GS-AI-PLAYBOOK-1E — Personalization evaluation service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildPersonalizationEvaluationReport,
  type GrowthPersonalizationEvaluationGenerationRecord,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-utils"
import type { GrowthPersonalizationEvaluationReport } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"
import { parsePersonalizationOperatorMetadata } from "@/lib/growth/personalization/personalization-generation-ux"
import type {
  GrowthPersonalizationIndustryPlaybookDiagnostics,
} from "@/lib/growth/personalization/personalization-types"
import type {
  GrowthPersonalizationNegativeFeedbackReason,
  GrowthPersonalizationOperatorEvaluationSentiment,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseIndustryPlaybookDiagnostics(
  metadata: unknown,
): GrowthPersonalizationIndustryPlaybookDiagnostics | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = (metadata as Record<string, unknown>).industry_playbook_diagnostics
  if (!raw || typeof raw !== "object") return null
  const entry = raw as Record<string, unknown>
  if (entry.isIndustryLevelIntelligence !== true) return null
  return {
    resolvedIndustryId: asString(entry.resolvedIndustryId) || null,
    resolvedIndustryLabel: asString(entry.resolvedIndustryLabel) || null,
    resolverConfidence: Number(entry.resolverConfidence ?? 0),
    matchedSignals: Array.isArray(entry.matchedSignals)
      ? entry.matchedSignals.filter((signal): signal is string => typeof signal === "string")
      : [],
    playbookDisplayName: asString(entry.playbookDisplayName) || null,
    playbookEvidenceCount: Number(entry.playbookEvidenceCount ?? 0),
    isIndustryLevelIntelligence: true,
    addedEvidenceLabels: Array.isArray(entry.addedEvidenceLabels)
      ? entry.addedEvidenceLabels.filter((label): label is string => typeof label === "string")
      : [],
  }
}

function parseOperatorEvaluationMetadata(metadata: unknown): {
  sentiment: GrowthPersonalizationOperatorEvaluationSentiment | null
  negativeReason: GrowthPersonalizationNegativeFeedbackReason | null
  note: string | null
} {
  if (!metadata || typeof metadata !== "object") {
    return { sentiment: null, negativeReason: null, note: null }
  }
  const raw = metadata as Record<string, unknown>
  const sentimentRaw = asString(raw.evaluation_sentiment)
  const sentiment =
    sentimentRaw === "helpful" || sentimentRaw === "not_helpful" ? sentimentRaw : null
  const negativeReasonRaw = asString(raw.negative_reason)
  const negativeReason = (
    [
      "too_generic",
      "wrong_industry_assumptions",
      "too_salesy",
      "missing_company_context",
      "too_long",
      "too_technical",
      "other",
    ] as const
  ).includes(negativeReasonRaw as GrowthPersonalizationNegativeFeedbackReason)
    ? (negativeReasonRaw as GrowthPersonalizationNegativeFeedbackReason)
    : null
  const note = asString(raw.custom_note) || asString(raw.evaluation_note) || null
  return { sentiment, negativeReason, note }
}

function playbookElementKeysFromClaimKeys(claimKeys: string[]): string[] {
  return claimKeys.filter((key) =>
    /^(industry_playbook_|recommended_cta)/.test(key),
  )
}

export async function fetchPersonalizationEvaluationRecords(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthPersonalizationEvaluationGenerationRecord[]> {
  const limit = input?.limit ?? 250
  const { data: generationRows, error } = await admin
    .schema("growth")
    .from("personalization_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  const generationIds = (generationRows ?? []).map((row) => asString((row as { id?: string }).id)).filter(Boolean)
  if (generationIds.length === 0) return []

  const [evidenceRes, feedbackRes] = await Promise.all([
    admin
      .schema("growth")
      .from("personalization_evidence")
      .select("generation_id, claim_key")
      .in("generation_id", generationIds),
    admin
      .schema("growth")
      .from("personalization_feedback")
      .select("generation_id, feedback_type, notes, metadata, recorded_at")
      .in("generation_id", generationIds)
      .order("recorded_at", { ascending: false }),
  ])
  if (evidenceRes.error) throw new Error(evidenceRes.error.message)
  if (feedbackRes.error) throw new Error(feedbackRes.error.message)

  const evidenceByGeneration = new Map<string, string[]>()
  for (const row of evidenceRes.data ?? []) {
    const generationId = asString((row as { generation_id?: string }).generation_id)
    const claimKey = asString((row as { claim_key?: string }).claim_key)
    if (!generationId || !claimKey) continue
    const bucket = evidenceByGeneration.get(generationId) ?? []
    bucket.push(claimKey)
    evidenceByGeneration.set(generationId, bucket)
  }

  const feedbackByGeneration = new Map<
    string,
    { sentiment: GrowthPersonalizationOperatorEvaluationSentiment | null; negativeReason: GrowthPersonalizationNegativeFeedbackReason | null; note: string | null }
  >()
  for (const row of feedbackRes.data ?? []) {
    const generationId = asString((row as { generation_id?: string }).generation_id)
    if (!generationId || feedbackByGeneration.has(generationId)) continue
    const feedbackType = asString((row as { feedback_type?: string }).feedback_type)
    const parsed = parseOperatorEvaluationMetadata((row as { metadata?: unknown }).metadata)
    const sentiment =
      parsed.sentiment ??
      (feedbackType === "performed_well"
        ? "helpful"
        : feedbackType === "performed_poorly"
          ? "not_helpful"
          : null)
    feedbackByGeneration.set(generationId, {
      sentiment,
      negativeReason: parsed.negativeReason,
      note: parsed.note || asString((row as { notes?: string }).notes) || null,
    })
  }

  return (generationRows ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const id = asString(record.id)
    const metadata = record.metadata
    const operatorMetadata = parsePersonalizationOperatorMetadata(metadata)
    const diagnostics = parseIndustryPlaybookDiagnostics(metadata)
    const evidenceClaimKeys = evidenceByGeneration.get(id) ?? []
    const operatorFeedback = feedbackByGeneration.get(id)

    return {
      id,
      leadId: asString(record.lead_id),
      status: asString(record.status) as GrowthPersonalizationEvaluationGenerationRecord["status"],
      personalizationScore: Number(record.personalization_score ?? 0),
      evidenceCoverageScore: Number(record.evidence_coverage_score ?? 0),
      subject: asString(record.subject),
      createdAt: asString(record.created_at),
      approvedAt: asString(record.approved_at) || null,
      rejectedAt: asString(record.rejected_at) || null,
      industryId: diagnostics?.resolvedIndustryId ?? null,
      industryLabel:
        diagnostics?.playbookDisplayName ??
        diagnostics?.resolvedIndustryLabel ??
        null,
      isRegeneration: Boolean(operatorMetadata?.prior_generation_id || operatorMetadata?.regeneration_feedback),
      regenerationCategory: operatorMetadata?.regeneration_feedback?.category ?? null,
      rejectionCategory: operatorMetadata?.rejection_feedback?.category ?? null,
      evidenceClaimKeys,
      playbookElementKeys: playbookElementKeysFromClaimKeys(evidenceClaimKeys),
      operatorSentiment: operatorFeedback?.sentiment ?? null,
      operatorNegativeReason: operatorFeedback?.negativeReason ?? null,
      operatorFeedbackNote: operatorFeedback?.note ?? null,
    } satisfies GrowthPersonalizationEvaluationGenerationRecord
  })
}

export async function fetchPersonalizationEvaluationReport(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthPersonalizationEvaluationReport> {
  const records = await fetchPersonalizationEvaluationRecords(admin, input)
  return buildPersonalizationEvaluationReport(records)
}
