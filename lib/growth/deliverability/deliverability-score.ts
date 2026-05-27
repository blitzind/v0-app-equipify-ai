/** Deterministic deliverability score from DNS check results. Client-safe. */

import type { GrowthDnsHealthTier, GrowthDeliverabilityRiskLevel } from "@/lib/growth/deliverability/deliverability-types"
import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"

export type DeliverabilityScoreInput = GrowthDnsCheckResult & {
  warnings?: string[]
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function isSpfMissing(input: DeliverabilityScoreInput): boolean {
  return !input.spf_present || !input.spf_valid
}

function isDkimMissing(input: DeliverabilityScoreInput): boolean {
  return !input.dkim_present || !input.dkim_valid
}

function isDmarcMissing(input: DeliverabilityScoreInput): boolean {
  return !input.dmarc_present || !input.dmarc_valid
}

function isMxInvalid(input: DeliverabilityScoreInput): boolean {
  return !input.mx_present || !input.mx_valid
}

export function computeDeliverabilityScore(input: DeliverabilityScoreInput): number {
  let score = 100

  if (isSpfMissing(input)) score -= 25
  if (isDkimMissing(input)) score -= 25
  if (isDmarcMissing(input)) score -= 20
  if (isMxInvalid(input)) score -= 20

  const warnings = input.warnings ?? []
  if (warnings.length > 2) score -= 10
  if (warnings.some((warning) => /critical/i.test(warning))) score -= 20

  return clampScore(score)
}

export function deliverabilityScoreToTier(score: number): GrowthDnsHealthTier {
  if (score >= 90) return "healthy"
  if (score >= 70) return "warning"
  if (score >= 40) return "degraded"
  return "critical"
}

export function deliverabilityScoreToRiskLevel(score: number): GrowthDeliverabilityRiskLevel {
  if (score >= 85) return "low"
  if (score >= 65) return "medium"
  if (score >= 40) return "high"
  return "critical"
}

export function computeAuthenticationScore(input: GrowthDnsCheckResult): number {
  const checks = [
    input.spf_present && input.spf_valid,
    input.dkim_present && input.dkim_valid,
    input.dmarc_present && input.dmarc_valid,
  ]
  const passed = checks.filter(Boolean).length
  return clampScore(Math.round((passed / 3) * 100))
}

export function computeInfrastructureScore(input: GrowthDnsCheckResult): number {
  return input.mx_present && input.mx_valid ? 100 : clampScore(100 - 20)
}
