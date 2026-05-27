/** Deterministic delivery provider health scoring. Client-safe. */

import type { GrowthDeliveryProviderStatus } from "@/lib/growth/providers/provider-types"

export type ProviderHealthInput = {
  status: GrowthDeliveryProviderStatus
  last_validation_at?: string | null
  has_health_failures?: boolean
  validation_stale_days?: number
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function isValidationStale(lastValidationAt: string | null | undefined, staleDays = 7): boolean {
  if (!lastValidationAt) return true
  const validatedAt = new Date(lastValidationAt)
  if (Number.isNaN(validatedAt.getTime())) return true
  const ageMs = Date.now() - validatedAt.getTime()
  return ageMs > staleDays * 24 * 60 * 60 * 1000
}

export function computeProviderHealthScore(input: ProviderHealthInput): number {
  let score = 100

  switch (input.status) {
    case "warning":
      score -= 10
      break
    case "degraded":
      score -= 25
      break
    case "disabled":
      score -= 40
      break
    case "draft":
      score -= 5
      break
    default:
      break
  }

  const staleDays = input.validation_stale_days ?? 7
  if (isValidationStale(input.last_validation_at, staleDays)) {
    score -= 15
  }

  if (input.has_health_failures) {
    score -= 20
  }

  return clampScore(score)
}

export function providerHealthTier(score: number): "healthy" | "warning" | "degraded" | "critical" {
  if (score >= 80) return "healthy"
  if (score >= 60) return "warning"
  if (score >= 40) return "degraded"
  return "critical"
}

export function providerStatusLabel(status: GrowthDeliveryProviderStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "connected":
      return "Connected"
    case "warning":
      return "Warning"
    case "degraded":
      return "Degraded"
    case "disabled":
      return "Disabled"
  }
}
