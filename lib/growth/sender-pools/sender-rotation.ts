import {
  filterEligibleSenderPoolMembers,
  evaluateSenderPoolMemberEligibility,
} from "@/lib/growth/sender-pools/sender-eligibility"
import type {
  GrowthSenderPoolMemberContext,
  GrowthSenderPoolRotationStrategy,
  GrowthSenderRotationDecisionReason,
  GrowthSenderRotationFallbackCandidate,
  GrowthSenderRotationOutput,
  GrowthSenderRotationRiskLevel,
} from "@/lib/growth/sender-pools/sender-pool-types"

export type SenderRotationInput = {
  strategy: GrowthSenderPoolRotationStrategy
  minComplianceScore: number
  requiresMailbox: boolean
  members: GrowthSenderPoolMemberContext[]
  manualSenderAccountId?: string | null
  allowAutoRotation?: boolean
  routeBySender?: Record<string, { providerId: string | null; routeId: string | null }>
}

function riskFromMember(member: GrowthSenderPoolMemberContext): GrowthSenderRotationRiskLevel {
  if (member.bounceRisk >= 80 || member.complaintRisk >= 80) return "critical"
  if (member.bounceRisk >= 50 || member.complaintRisk >= 50 || member.healthScore < 40) return "high"
  if (member.healthScore < 60 || member.recentVolume >= 300) return "medium"
  return "low"
}

function primaryReasonForMember(member: GrowthSenderPoolMemberContext): GrowthSenderRotationDecisionReason {
  if (member.dailyCapRemaining <= 10) return "daily_cap_remaining"
  if (member.reputationScore >= 80) return "reputation_score"
  if (member.warmupProgress > 0 && member.warmupProgress < 100) return "warmup_status"
  if (member.recentVolume <= 50) return "recent_volume"
  if (member.providerHealthScore >= 70) return "provider_health"
  if (member.domainHealthScore >= 70) return "domain_health"
  return "health_score"
}

function scoreMember(strategy: GrowthSenderPoolRotationStrategy, member: GrowthSenderPoolMemberContext): number {
  switch (strategy) {
    case "round_robin": {
      const last = member.lastSelectedAt ? new Date(member.lastSelectedAt).getTime() : 0
      return last === 0 ? Number.MAX_SAFE_INTEGER : -last
    }
    case "lowest_volume":
      return -member.recentVolume
    case "best_reputation":
      return member.reputationScore
    case "warmup_safe":
      return member.warmupProgress * 2 + member.healthScore - member.recentVolume * 0.1
    case "manual_priority":
      return member.manualPriority * 1000 + member.healthScore
    case "weighted_health":
    default:
      return (
        member.healthScore * 0.35 +
        member.reputationScore * 0.25 +
        member.domainHealthScore * 0.15 +
        member.providerHealthScore * 0.15 +
        member.complianceScore * 0.1 -
        member.bounceRisk * 0.2 -
        member.complaintRisk * 0.3 -
        member.recentVolume * 0.05 +
        member.priorityWeight * 0.01
      )
  }
}

function buildFallbacks(
  ranked: GrowthSenderPoolMemberContext[],
  selectedId: string,
  routeBySender: Record<string, { providerId: string | null; routeId: string | null }>,
  limit = 3,
): GrowthSenderRotationFallbackCandidate[] {
  return ranked
    .filter((member) => member.senderAccountId !== selectedId)
    .slice(0, limit)
    .map((member) => ({
      senderAccountId: member.senderAccountId,
      senderLabel: member.senderLabel,
      reason: primaryReasonForMember(member),
      riskLevel: riskFromMember(member),
    }))
    .filter((candidate) => routeBySender[candidate.senderAccountId]?.routeId != null || true)
}

export function selectSenderFromPool(input: SenderRotationInput): GrowthSenderRotationOutput {
  const allowAutoRotation = input.allowAutoRotation !== false
  const routeBySender = input.routeBySender ?? {}

  if (!allowAutoRotation && input.manualSenderAccountId) {
    const manual = input.members.find((m) => m.senderAccountId === input.manualSenderAccountId)
    const route = routeBySender[input.manualSenderAccountId] ?? { providerId: null, routeId: null }
    return {
      selectedSenderAccountId: input.manualSenderAccountId,
      selectedProviderId: route.providerId,
      selectedRouteId: route.routeId,
      reason: "manual_override",
      riskLevel: manual ? riskFromMember(manual) : "medium",
      fallbackSenderCandidates: [],
    }
  }

  const eligible = filterEligibleSenderPoolMembers(
    input.members,
    input.minComplianceScore,
    input.requiresMailbox,
  )

  if (eligible.length === 0) {
    return {
      selectedSenderAccountId: null,
      selectedProviderId: null,
      selectedRouteId: null,
      reason: "health_score",
      riskLevel: "critical",
      fallbackSenderCandidates: [],
    }
  }

  const ranked = [...eligible].sort((a, b) => scoreMember(input.strategy, b) - scoreMember(input.strategy, a))
  const selected = ranked[0]!
  const route = routeBySender[selected.senderAccountId] ?? { providerId: null, routeId: null }

  return {
    selectedSenderAccountId: selected.senderAccountId,
    selectedProviderId: route.providerId,
    selectedRouteId: route.routeId,
    reason: primaryReasonForMember(selected),
    riskLevel: riskFromMember(selected),
    fallbackSenderCandidates: buildFallbacks(ranked, selected.senderAccountId, routeBySender),
  }
}

export function explainIneligibleMembers(
  members: GrowthSenderPoolMemberContext[],
  minComplianceScore: number,
  requiresMailbox: boolean,
): Array<{ senderAccountId: string; senderLabel: string; reasons: string[] }> {
  return members
    .map((member) => {
      const result = evaluateSenderPoolMemberEligibility(member, minComplianceScore, requiresMailbox)
      if (result.eligible) return null
      return {
        senderAccountId: member.senderAccountId,
        senderLabel: member.senderLabel,
        reasons: result.blockedReasons,
      }
    })
    .filter((row): row is { senderAccountId: string; senderLabel: string; reasons: string[] } => row != null)
}

export function computeRotationHealthScore(input: {
  eligibleCount: number
  totalMembers: number
  cooldownCount: number
  fatigueWarnings: number
  averageReputation: number
}): number {
  if (input.totalMembers <= 0) return 0
  const eligibleRatio = input.eligibleCount / input.totalMembers
  const cooldownPenalty = Math.min(40, input.cooldownCount * 8)
  const fatiguePenalty = Math.min(30, input.fatigueWarnings * 6)
  const reputationBonus = Math.min(20, input.averageReputation * 0.2)
  return Math.max(
    0,
    Math.min(100, Math.round(eligibleRatio * 70 + reputationBonus - cooldownPenalty - fatiguePenalty)),
  )
}
