import { CATALOG_AI_CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/catalog/ai-verification-threshold"

export type CatalogAiRowSignals = {
  ai_generated: boolean | null
  ai_confidence: number | null
  confidence_score: number | null
  human_verified_at: string | null
}

/**
 * UI label for a catalog row. Priority: verified > needs attention (low/missing confidence) > AI-sourced pending review.
 */
export function getCatalogAiStatusLabel(row: CatalogAiRowSignals): "verified" | "needs_review" | "ai_generated" | null {
  if (row.human_verified_at) return "verified"
  if (!row.ai_generated) return null
  const conf = row.ai_confidence ?? row.confidence_score
  if (conf == null || conf < CATALOG_AI_CONFIDENCE_REVIEW_THRESHOLD) return "needs_review"
  return "ai_generated"
}
