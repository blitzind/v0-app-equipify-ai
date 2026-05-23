import "server-only"

import { z } from "zod"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"

export const GROWTH_LEAD_FIT_MODEL_VERSION = "v1" as const

const stringArray = z.array(z.string().trim()).transform((items) =>
  items.map((s) => s.trim()).filter(Boolean).slice(0, 12),
)

/** Snake_case schema matching the LLM JSON contract. */
export const growthLeadResearchModelSchema = z.object({
  company_summary: z.string(),
  website_summary: z.string().nullable().optional(),
  likely_service_category: z.string().nullable().optional(),
  service_area_clues: stringArray.optional().default([]),
  company_size_estimate: z.string().nullable().optional(),
  equipment_service_indicators: stringArray.optional().default([]),
  equipify_pain_points: stringArray.optional().default([]),
  equipify_fit_score: z.number().int().min(0).max(100),
  outreach_angles: stringArray.optional().default([]),
  recommended_next_action: z.string(),
  research_confidence: z.number().min(0).max(1),
  source_urls: stringArray.optional().default([]),
  caveats: stringArray.optional().default([]),
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
    fitModelVersion: GROWTH_LEAD_FIT_MODEL_VERSION,
  }
}
