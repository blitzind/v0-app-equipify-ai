/** GE-AIOS-8A-4 — Evidence-constrained Business Intelligence AI recommendations (server-only). */

import "server-only"

import { runAiTask } from "@/lib/ai/server"
import {
  buildBusinessIntelligenceAiSystemPrompt,
  buildBusinessIntelligenceAiUserPrompt,
} from "@/lib/growth/business-intelligence/business-intelligence-ai-prompts"
import {
  businessIntelligenceAiModelSchema,
  type BusinessIntelligenceAiContextField,
  type BusinessIntelligenceAiContextGap,
  type BusinessIntelligenceAiContextPayload,
  type BusinessIntelligenceAiRecommendation,
  type BusinessIntelligenceAiRecommendationsMetadata,
  type BusinessIntelligenceAiRecommendationsResult,
  validateAndSanitizeBusinessIntelligenceAiModel,
} from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
import { isUnknownField } from "@/lib/growth/business-intelligence/business-intelligence-fact-mapper"
import type {
  BusinessIntelligenceGap,
  BusinessIntelligenceReport,
  BusinessIntelligenceReportField,
  BusinessIntelligenceReportSections,
} from "@/lib/growth/business-intelligence/business-intelligence-types"

export type { BusinessIntelligenceAiContextPayload } from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"
export type { BusinessIntelligenceAiRecommendationsMetadata } from "@/lib/growth/business-intelligence/business-intelligence-ai-schema"

export type GenerateBusinessIntelligenceAiRecommendationsDeps = {
  runAiRecommendations?: (input: {
    organizationId: string
    context: BusinessIntelligenceAiContextPayload
  }) => Promise<BusinessIntelligenceAiRecommendationsResult>
}

function fieldEntries(sections: BusinessIntelligenceReportSections): Array<[string, BusinessIntelligenceReportField]> {
  const entries: Array<[string, BusinessIntelligenceReportField]> = []
  for (const [sectionKey, section] of Object.entries(sections)) {
    for (const [fieldKey, field] of Object.entries(section)) {
      entries.push([`${sectionKey}.${fieldKey}`, field])
    }
  }
  return entries
}

export function buildBusinessIntelligenceAiContext(
  report: BusinessIntelligenceReport,
): BusinessIntelligenceAiContextPayload {
  const evidenceBackedFields: BusinessIntelligenceAiContextField[] = []

  for (const [fieldKey, field] of fieldEntries(report.sections)) {
    if (isUnknownField(field)) continue
    const value = field.value
    if (value == null) continue

    evidenceBackedFields.push({
      field_key: fieldKey,
      value,
      confidence: field.confidence,
      supporting_evidence_ids: [...field.supporting_evidence_ids],
      source_providers: [...field.source_providers],
      decision_tiers: [...field.decision_tiers],
      lifecycle_status: field.lifecycle_status,
      needs_review: field.needs_review,
    })
  }

  const allowedEvidenceIds = [
    ...new Set(evidenceBackedFields.flatMap((field) => field.supporting_evidence_ids)),
  ]
  const allowedGapIds = report.gaps.map((gap) => gap.gap_id)

  return {
    allowed_evidence_ids: allowedEvidenceIds,
    allowed_gap_ids: allowedGapIds,
    confidence_summary: report.confidence_summary,
    evidence_backed_fields: evidenceBackedFields,
    gaps: report.gaps.map(mapGapForContext),
    contradictions: report.contradictions.map((item) => ({
      fact_key: item.fact_key,
      conflicting_values: [...item.conflicting_values],
      evidence_ids: [...item.evidence_ids],
      requires_human_review: item.requires_human_review,
    })),
  }
}

function mapGapForContext(gap: BusinessIntelligenceGap): BusinessIntelligenceAiContextGap {
  return {
    gap_id: gap.gap_id,
    gap_code: gap.gap_code,
    severity: gap.severity,
    title: gap.title,
    message: gap.message,
    related_fields: [...gap.related_fields],
    requires_user_confirmation: gap.requires_user_confirmation,
  }
}

export function buildDeterministicGapRecommendations(
  report: BusinessIntelligenceReport,
): BusinessIntelligenceAiRecommendation[] {
  const recommendations: BusinessIntelligenceAiRecommendation[] = []
  let index = 0

  for (const gap of report.gaps) {
    recommendations.push({
      recommendation_id: `bi-gap-rec-${index + 1}`,
      category: gap.gap_code === "company_description_conflict" ? "evidence_conflict" : "missing_information",
      recommendation: gap.message,
      confidence: gap.severity === "high" ? 0.85 : gap.severity === "medium" ? 0.7 : 0.6,
      reasoning: [
        `Deterministic recommendation from identified gap: ${gap.gap_code}.`,
        gap.requires_user_confirmation
          ? "Operator confirmation is required before Ava acts on this area."
          : "Additional evidence would improve confidence.",
      ],
      supporting_evidence_ids: [],
      related_gap_ids: [gap.gap_id],
      requires_human_review: true,
      editable_by_user: true,
    })
    index += 1
  }

  return recommendations
}

async function defaultRunAiRecommendations(input: {
  organizationId: string
  context: BusinessIntelligenceAiContextPayload
}): Promise<BusinessIntelligenceAiRecommendationsResult> {
  try {
    const result = await runAiTask({
      task: "growth_business_intelligence_recommendations",
      organizationId: input.organizationId,
      input: {
        system: buildBusinessIntelligenceAiSystemPrompt(),
        user: buildBusinessIntelligenceAiUserPrompt(input.context),
      },
      schema: businessIntelligenceAiModelSchema,
      cacheSchemaVersion: "growth_business_intelligence_recommendations_v1",
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: false,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!result.ok || !result.output) {
      return { ok: false, error: result.error?.message ?? "AI task failed.", recommendations: [] }
    }

    return validateAndSanitizeBusinessIntelligenceAiModel({
      model: result.output,
      allowedEvidenceIds: new Set(input.context.allowed_evidence_ids),
      allowedGapIds: new Set(input.context.allowed_gap_ids),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI recommendation error."
    return { ok: false, error: message, recommendations: [] }
  }
}

export async function generateBusinessIntelligenceAiRecommendations(input: {
  organizationId: string
  report: BusinessIntelligenceReport
  deps?: GenerateBusinessIntelligenceAiRecommendationsDeps
}): Promise<{
  recommendations: BusinessIntelligenceAiRecommendation[] | null
  metadata: BusinessIntelligenceAiRecommendationsMetadata
}> {
  const context = buildBusinessIntelligenceAiContext(input.report)
  const runAi = input.deps?.runAiRecommendations ?? defaultRunAiRecommendations

  const aiResult = await runAi({
    organizationId: input.organizationId,
    context,
  })

  if (aiResult.ok) {
    return {
      recommendations: aiResult.recommendations,
      metadata: {
        status: "ok",
        recommendation_count: aiResult.recommendations.length,
      },
    }
  }

  const fallback = buildDeterministicGapRecommendations(input.report)
  if (fallback.length > 0) {
    return {
      recommendations: fallback,
      metadata: {
        status: "failed",
        error: aiResult.error,
        recommendation_count: fallback.length,
      },
    }
  }

  return {
    recommendations: null,
    metadata: {
      status: "failed",
      error: aiResult.error,
      recommendation_count: 0,
    },
  }
}
