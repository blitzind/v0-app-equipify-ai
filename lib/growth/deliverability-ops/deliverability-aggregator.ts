import type {
  GrowthDeliverabilityEntityType,
  GrowthDeliverabilityEvidenceSnippet,
  GrowthDeliverabilitySeverity,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export type DeliverabilityAggregatorInput = {
  senderCount?: number
  senderReputationAvg?: number
  domainHealthAvg?: number
  providerHealthAvg?: number
  complianceRiskAvg?: number
  warmupHealthAvg?: number
  volumePressureAvg?: number
  openRiskCount?: number
  bounceRate?: number
  complaintRate?: number
  unsubscribeRate?: number
  openRate?: number
  clickRate?: number
  replyRate?: number
  spfValidPct?: number
  dkimValidPct?: number
  dmarcValidPct?: number
  rateLimitPressurePct?: number
  poolFatigueWarnings?: number
}

export type DeliverabilityAggregatedScores = {
  overallDeliverability: number
  senderReputation: number
  domainHealth: number
  providerHealth: number
  complianceRisk: number
  warmupHealth: number
  volumePressure: number
  riskAlerts: number
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function aggregateDeliverabilityScores(
  input: DeliverabilityAggregatorInput,
): DeliverabilityAggregatedScores {
  const senderReputation = clamp(input.senderReputationAvg ?? 75)
  const domainHealth = clamp(input.domainHealthAvg ?? 75)
  const providerHealth = clamp(input.providerHealthAvg ?? 80)
  const warmupHealth = clamp(input.warmupHealthAvg ?? 85)
  const volumePressure = clamp(input.volumePressureAvg ?? 20)

  const bouncePenalty = clamp((input.bounceRate ?? 0) * 4, 0, 40)
  const complaintPenalty = clamp((input.complaintRate ?? 0) * 20, 0, 50)
  const unsubscribePenalty = clamp((input.unsubscribeRate ?? 0) * 8, 0, 30)
  const complianceRisk = clamp(
    input.complianceRiskAvg ?? bouncePenalty + complaintPenalty + unsubscribePenalty,
  )

  const authBonus = avg([
    input.spfValidPct ?? 100,
    input.dkimValidPct ?? 100,
    input.dmarcValidPct ?? 100,
  ])
  const engagementScore = avg([
    input.openRate ?? 25,
    (input.clickRate ?? 3) * 5,
    (input.replyRate ?? 2) * 8,
  ])

  const overallDeliverability = clamp(
    avg([senderReputation, domainHealth, providerHealth, warmupHealth, authBonus, engagementScore]) -
      complianceRisk * 0.35 -
      volumePressure * 0.15,
  )

  const riskAlerts =
    (input.openRiskCount ?? 0) +
    (input.poolFatigueWarnings ?? 0) +
    (input.rateLimitPressurePct != null && input.rateLimitPressurePct >= 70 ? 1 : 0)

  return {
    overallDeliverability: Math.round(overallDeliverability * 100) / 100,
    senderReputation: Math.round(senderReputation * 100) / 100,
    domainHealth: Math.round(domainHealth * 100) / 100,
    providerHealth: Math.round(providerHealth * 100) / 100,
    complianceRisk: Math.round(complianceRisk * 100) / 100,
    warmupHealth: Math.round(warmupHealth * 100) / 100,
    volumePressure: Math.round(volumePressure * 100) / 100,
    riskAlerts,
  }
}

export function buildEvidenceSnippet(
  label: string,
  value: string | number,
  source: string,
): GrowthDeliverabilityEvidenceSnippet {
  return {
    label: label.slice(0, 120),
    value: String(value).slice(0, 200),
    source: source.slice(0, 80),
  }
}

export function severityRank(severity: GrowthDeliverabilitySeverity): number {
  switch (severity) {
    case "low":
      return 1
    case "medium":
      return 2
    case "high":
      return 3
    case "critical":
      return 4
    default:
      return 0
  }
}

export function highestSeverity(
  severities: GrowthDeliverabilitySeverity[],
): GrowthDeliverabilitySeverity {
  if (severities.length === 0) return "low"
  return severities.reduce((best, current) =>
    severityRank(current) > severityRank(best) ? current : best,
  )
}

export function entityTypeFromScope(scope: string): GrowthDeliverabilityEntityType {
  switch (scope) {
    case "sender":
    case "domain":
    case "provider":
    case "pool":
    case "route":
      return scope
    default:
      return "platform"
  }
}
