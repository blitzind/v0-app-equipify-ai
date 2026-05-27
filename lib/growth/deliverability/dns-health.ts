/** DNS health tier helpers. Client-safe. */

import {
  computeAuthenticationScore,
  computeDeliverabilityScore,
  computeInfrastructureScore,
  deliverabilityScoreToTier,
} from "@/lib/growth/deliverability/deliverability-score"
import { generateDnsRecommendations, generateDnsWarnings } from "@/lib/growth/deliverability/dns-recommendations"
import type { GrowthDnsCheckResult, GrowthDnsHealthTier } from "@/lib/growth/deliverability/deliverability-types"

export type DnsHealthEvaluation = {
  dns_health_score: number
  health_tier: GrowthDnsHealthTier
  authentication_score: number
  infrastructure_score: number
  warnings: string[]
  recommendations: string[]
}

export function evaluateDnsHealth(input: GrowthDnsCheckResult & { stub_mode?: boolean }): DnsHealthEvaluation {
  const warnings = generateDnsWarnings(input)
  const recommendations = generateDnsRecommendations(input)
  const dns_health_score = computeDeliverabilityScore({ ...input, warnings })

  return {
    dns_health_score,
    health_tier: deliverabilityScoreToTier(dns_health_score),
    authentication_score: computeAuthenticationScore(input),
    infrastructure_score: computeInfrastructureScore(input),
    warnings,
    recommendations,
  }
}

export function dnsHealthTierLabel(tier: GrowthDnsHealthTier): string {
  switch (tier) {
    case "healthy":
      return "Healthy"
    case "warning":
      return "Warning"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
  }
}
