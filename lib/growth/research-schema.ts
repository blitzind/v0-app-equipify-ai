import "server-only"

import { z } from "zod"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"

export const GROWTH_LEAD_FIT_MODEL_VERSION = "v1" as const

const MAX_STRING_LIST_ITEMS = 12

/** Normalize AI list fields that may arrive as string, array, null, or mixed scalars. */
export function normalizeGrowthLeadResearchStringList(value: unknown, maxItems = MAX_STRING_LIST_ITEMS): string[] {
  if (value == null) return []

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed].slice(0, maxItems) : []
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") {
          const trimmed = item.trim()
          return trimmed ? [trimmed] : []
        }
        if (item == null) return []
        const trimmed = String(item).trim()
        return trimmed ? [trimmed] : []
      })
      .slice(0, maxItems)
  }

  const trimmed = String(value).trim()
  return trimmed ? [trimmed].slice(0, maxItems) : []
}

export function clampGrowthLeadFitScore(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

export function clampGrowthLeadResearchConfidence(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(1, Math.max(0, parsed))
}

export function normalizeGrowthLeadFitModelVersion(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  return GROWTH_LEAD_FIT_MODEL_VERSION
}

const tolerantStringArray = z.preprocess(
  (value) => normalizeGrowthLeadResearchStringList(value),
  z.array(z.string()).max(MAX_STRING_LIST_ITEMS),
)

const clampedFitScore = z.preprocess(
  (value) => clampGrowthLeadFitScore(value),
  z.number().int().min(0).max(100),
)

const clampedResearchConfidence = z.preprocess(
  (value) => clampGrowthLeadResearchConfidence(value),
  z.number().min(0).max(1),
)

const fitModelVersion = z.preprocess(
  (value) => normalizeGrowthLeadFitModelVersion(value),
  z.string().min(1),
)

const decisionMakerCandidateSchema = z.object({
  full_name: z.string(),
  title: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  confidence: z.preprocess((value) => clampGrowthLeadResearchConfidence(value), z.number().min(0).max(1)).optional(),
  evidence_excerpt: z.string().nullable().optional(),
})

/** Snake_case schema matching the LLM JSON contract. */
export const growthLeadResearchModelSchema = z.object({
  company_summary: z.string(),
  website_summary: z.string().nullable().optional(),
  likely_service_category: z.string().nullable().optional(),
  service_area_clues: tolerantStringArray.optional().default([]),
  company_size_estimate: z.string().nullable().optional(),
  equipment_service_indicators: tolerantStringArray.optional().default([]),
  equipify_pain_points: tolerantStringArray.optional().default([]),
  equipify_fit_score: clampedFitScore,
  outreach_angles: tolerantStringArray.optional().default([]),
  recommended_next_action: z.string(),
  research_confidence: clampedResearchConfidence,
  source_urls: tolerantStringArray.optional().default([]),
  caveats: tolerantStringArray.optional().default([]),
  fit_model_version: fitModelVersion.optional().default(GROWTH_LEAD_FIT_MODEL_VERSION),
  decision_maker_candidates: z.array(decisionMakerCandidateSchema).optional().default([]),
  estimated_annual_revenue: z.string().nullable().optional(),
  estimated_employee_count: z.string().nullable().optional(),
  fleet_size_estimate: z.string().nullable().optional(),
  crm_detected: z.string().nullable().optional(),
  field_service_stack_detected: z.string().nullable().optional(),
})

export type GrowthLeadResearchModelResult = z.infer<typeof growthLeadResearchModelSchema>

export function mapGrowthLeadResearchModelToResult(row: GrowthLeadResearchModelResult): GrowthLeadResearchResult {
  const companySummary = row.company_summary.trim()
  const recommendedNextAction = row.recommended_next_action.trim()
  if (!companySummary) throw new Error("company_summary required")
  if (!recommendedNextAction) throw new Error("recommended_next_action required")

  return {
    companySummary,
    websiteSummary: row.website_summary?.trim() ? row.website_summary.trim() : null,
    likelyServiceCategory: row.likely_service_category?.trim() ? row.likely_service_category.trim() : null,
    serviceAreaClues: row.service_area_clues,
    companySizeEstimate: row.company_size_estimate?.trim() ? row.company_size_estimate.trim() : null,
    equipmentServiceIndicators: row.equipment_service_indicators,
    equipifyPainPoints: row.equipify_pain_points,
    equipifyFitScore: row.equipify_fit_score,
    outreachAngles: row.outreach_angles,
    recommendedNextAction,
    researchConfidence: row.research_confidence,
    sourceUrls: row.source_urls,
    caveats: row.caveats,
    fitModelVersion: row.fit_model_version ?? GROWTH_LEAD_FIT_MODEL_VERSION,
    decisionMakerCandidates: (row.decision_maker_candidates ?? []).flatMap((candidate) => {
      const fullName = candidate.full_name?.trim()
      if (!fullName) return []
      return [
        {
          fullName,
          title: candidate.title?.trim() ? candidate.title.trim() : null,
          email: candidate.email?.trim() ? candidate.email.trim() : null,
          phone: candidate.phone?.trim() ? candidate.phone.trim() : null,
          linkedinUrl: candidate.linkedin_url?.trim() ? candidate.linkedin_url.trim() : null,
          confidence: candidate.confidence ?? null,
          evidenceExcerpt: candidate.evidence_excerpt?.trim() ? candidate.evidence_excerpt.trim() : null,
        },
      ]
    }),
    estimatedAnnualRevenue: row.estimated_annual_revenue?.trim() ? row.estimated_annual_revenue.trim() : null,
    estimatedEmployeeCount: row.estimated_employee_count?.trim() ? row.estimated_employee_count.trim() : null,
    fleetSizeEstimate: row.fleet_size_estimate?.trim() ? row.fleet_size_estimate.trim() : null,
    crmDetected: row.crm_detected?.trim() ? row.crm_detected.trim() : null,
    fieldServiceStackDetected: row.field_service_stack_detected?.trim()
      ? row.field_service_stack_detected.trim()
      : null,
  }
}
