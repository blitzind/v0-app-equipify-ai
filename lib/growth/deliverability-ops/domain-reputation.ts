import type { GrowthDeliverabilityDomainTrend } from "@/lib/growth/deliverability-ops/deliverability-ops-types"
import { maskDomainLabel } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export type DomainReputationInput = {
  domainId: string
  domain: string
  reputationScore: number
  bounceRate: number
  complaintRate: number
  authenticationScore: number
  previousReputationScore?: number
}

export type DomainReputationSnapshot = {
  domainId: string
  domainLabel: string
  reputationScore: number
  bounceRate: number
  complaintRate: number
  authenticationScore: number
  trend: GrowthDeliverabilityDomainTrend
}

export function computeDomainReputationTrend(
  current: number,
  previous?: number,
): GrowthDeliverabilityDomainTrend {
  if (previous == null) return "stable"
  const delta = current - previous
  if (delta >= 5) return "improving"
  if (delta <= -5) return "declining"
  return "stable"
}

export function buildDomainReputationSnapshot(input: DomainReputationInput): DomainReputationSnapshot {
  const trend = computeDomainReputationTrend(input.reputationScore, input.previousReputationScore)
  return {
    domainId: input.domainId,
    domainLabel: maskDomainLabel(input.domain),
    reputationScore: Math.round(input.reputationScore * 100) / 100,
    bounceRate: Math.round(input.bounceRate * 100) / 100,
    complaintRate: Math.round(input.complaintRate * 1000) / 1000,
    authenticationScore: Math.round(input.authenticationScore * 100) / 100,
    trend,
  }
}

export function aggregateDomainAuthenticationScore(input: {
  spfValid?: boolean
  dkimValid?: boolean
  dmarcValid?: boolean
}): number {
  let score = 0
  if (input.spfValid) score += 35
  if (input.dkimValid) score += 35
  if (input.dmarcValid) score += 30
  return score
}

export function domainReputationHealthTier(score: number): "healthy" | "warning" | "critical" {
  if (score >= 70) return "healthy"
  if (score >= 45) return "warning"
  return "critical"
}
