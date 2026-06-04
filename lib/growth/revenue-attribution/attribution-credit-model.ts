/**
 * Phase 6.33A — Multi-touch attribution credit distribution (client-safe).
 */

import type { GrowthAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-types"

export const GROWTH_ATTRIBUTION_CREDIT_MODEL_QA_MARKER = "growth-attribution-credit-model-v1" as const

export const GROWTH_ATTRIBUTION_MODELS = [
  "first_touch",
  "last_touch",
  "linear",
  "time_decay",
] as const

export type GrowthAttributionModel = (typeof GROWTH_ATTRIBUTION_MODELS)[number]

/** Half-life in days for time-decay (deterministic). */
export const GROWTH_ATTRIBUTION_TIME_DECAY_HALF_LIFE_DAYS = 14

export type AttributionTouchCredit = {
  touchId: string
  attributionModel: GrowthAttributionModel
  attributionWeight: number
  attributionConfidence: number
}

export type StoredPathTouchCredits = {
  attribution_model: GrowthAttributionModel
  touch_id: string
  attribution_weight: number
  attribution_confidence: number
}

export function isGrowthAttributionModel(value: string | null | undefined): value is GrowthAttributionModel {
  return GROWTH_ATTRIBUTION_MODELS.includes(value as GrowthAttributionModel)
}

export function attributionModelLabel(model: GrowthAttributionModel): string {
  switch (model) {
    case "first_touch":
      return "First touch"
    case "last_touch":
      return "Last touch"
    case "linear":
      return "Linear"
    case "time_decay":
      return "Time decay"
    default:
      return model
  }
}

function orderTouches(touches: GrowthAttributionTouch[]): GrowthAttributionTouch[] {
  return [...touches].sort((a, b) => a.touchedAt.localeCompare(b.touchedAt))
}

function normalizeWeights(raw: number[]): number[] {
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return raw.map(() => 0)
  return raw.map((w) => w / sum)
}

function pathConfidenceFactor(touchCount: number): number {
  if (touchCount >= 5) return 1
  if (touchCount >= 3) return 0.92
  if (touchCount >= 2) return 0.85
  return 0.75
}

function touchConfidence(touch: GrowthAttributionTouch, touchCount: number): number {
  const base = Math.max(0, Math.min(1, touch.attributionConfidence))
  return Math.round(base * pathConfidenceFactor(touchCount) * 10000) / 10000
}

function rawWeightsForModel(
  model: GrowthAttributionModel,
  ordered: GrowthAttributionTouch[],
  creditAnchorAt: string,
): number[] {
  if (ordered.length === 0) return []

  if (model === "linear") {
    return ordered.map(() => 1)
  }

  if (model === "first_touch") {
    return ordered.map((_, i) => (i === 0 ? 1 : 0))
  }

  if (model === "last_touch") {
    return ordered.map((_, i) => (i === ordered.length - 1 ? 1 : 0))
  }

  const anchorMs = Date.parse(creditAnchorAt)
  const halfLife = GROWTH_ATTRIBUTION_TIME_DECAY_HALF_LIFE_DAYS
  return ordered.map((touch) => {
    const touchMs = Date.parse(touch.touchedAt)
    const ageDays = Math.max(0, (anchorMs - touchMs) / (24 * 60 * 60 * 1000))
    return Math.pow(0.5, ageDays / halfLife)
  })
}

export function computeTouchAttributionCredits(
  model: GrowthAttributionModel,
  touches: GrowthAttributionTouch[],
  creditAnchorAt: string,
): AttributionTouchCredit[] {
  const ordered = orderTouches(touches)
  if (ordered.length === 0) return []

  const normalized = normalizeWeights(rawWeightsForModel(model, ordered, creditAnchorAt))
  const touchCount = ordered.length
  const rounded = normalized.map((w) => Math.round(w * 10000) / 10000)
  const drift = Math.round((1 - rounded.reduce((sum, w) => sum + w, 0)) * 10000) / 10000
  if (rounded.length > 0 && drift !== 0) {
    rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1]! + drift) * 10000) / 10000
  }

  return ordered.map((touch, index) => ({
    touchId: touch.id,
    attributionModel: model,
    attributionWeight: rounded[index]!,
    attributionConfidence: touchConfidence(touch, touchCount),
  }))
}

/** Persisted under attribution_paths.path_summary.touch_credits_by_model */
export function buildStoredTouchCreditsByModel(
  touches: GrowthAttributionTouch[],
  creditAnchorAt: string,
): Record<GrowthAttributionModel, StoredPathTouchCredits[]> {
  const result = {} as Record<GrowthAttributionModel, StoredPathTouchCredits[]>
  for (const model of GROWTH_ATTRIBUTION_MODELS) {
    result[model] = computeTouchAttributionCredits(model, touches, creditAnchorAt).map((credit) => ({
      attribution_model: credit.attributionModel,
      touch_id: credit.touchId,
      attribution_weight: credit.attributionWeight,
      attribution_confidence: credit.attributionConfidence,
    }))
  }
  return result
}

export function readStoredCreditsForModel(
  pathSummary: Record<string, unknown> | undefined,
  model: GrowthAttributionModel,
): StoredPathTouchCredits[] | null {
  const byModel = pathSummary?.touch_credits_by_model as
    | Record<string, StoredPathTouchCredits[]>
    | undefined
  const stored = byModel?.[model]
  return Array.isArray(stored) && stored.length > 0 ? stored : null
}

export function creditsFromPathSummaryOrCompute(
  model: GrowthAttributionModel,
  touches: GrowthAttributionTouch[],
  creditAnchorAt: string,
  pathSummary?: Record<string, unknown>,
): AttributionTouchCredit[] {
  const stored = readStoredCreditsForModel(pathSummary, model)
  if (stored) {
    return stored.map((row) => ({
      touchId: row.touch_id,
      attributionModel: row.attribution_model,
      attributionWeight: row.attribution_weight,
      attributionConfidence: row.attribution_confidence,
    }))
  }
  return computeTouchAttributionCredits(model, touches, creditAnchorAt)
}
