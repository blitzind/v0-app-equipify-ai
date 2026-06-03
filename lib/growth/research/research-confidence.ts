/** Normalize lead (0–1) and prospect (0–100) research confidence to 0–100. */

export function normalizeGrowthResearchConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value <= 1) return Math.round(Math.min(100, Math.max(0, value * 100)))
  return Math.round(Math.min(100, Math.max(0, value)))
}
