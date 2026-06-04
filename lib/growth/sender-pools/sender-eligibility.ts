import { isHealthAwareRoutingEligible } from "@/lib/growth/sender-pools/health-aware-routing"
import type {
  GrowthSenderPoolMemberContext,
  GrowthSenderRotationDecisionReason,
} from "@/lib/growth/sender-pools/sender-pool-types"

export type SenderEligibilityResult = {
  eligible: boolean
  blockedReasons: string[]
  primaryReason: GrowthSenderRotationDecisionReason | null
}

export function evaluateSenderPoolMemberEligibility(
  member: GrowthSenderPoolMemberContext,
  minComplianceScore: number,
  requiresMailbox: boolean,
): SenderEligibilityResult {
  const blockedReasons: string[] = []

  if (member.memberStatus === "blocked" || member.memberStatus === "paused") {
    blockedReasons.push(`Member status: ${member.memberStatus}`)
  }
  if (member.memberStatus === "cooldown" && member.cooldownUntil) {
    const until = new Date(member.cooldownUntil).getTime()
    if (Number.isFinite(until) && until > Date.now()) {
      blockedReasons.push("Member in cooldown")
    }
  }
  if (!member.senderConnected) blockedReasons.push("Sender not connected")
  if (requiresMailbox && !member.mailboxConnected) blockedReasons.push("Mailbox not connected")
  if (member.suppressed || member.disabled) blockedReasons.push("Sender suppressed or disabled")
  if (member.warmupHealthCritical) blockedReasons.push("Warmup health critical")
  if (member.senderReputationCritical) blockedReasons.push("Sender reputation critical")
  if (member.domainDeliverabilityCritical) blockedReasons.push("Domain deliverability critical")
  if (member.dailyCapRemaining <= 0) blockedReasons.push("Daily cap exhausted")
  if (!member.providerRouteAvailable) blockedReasons.push("No provider route available")
  if (member.complianceScore < minComplianceScore) blockedReasons.push("Compliance score below pool minimum")
  if (member.mailboxHealthState === "critical") blockedReasons.push("Mailbox health critical")
  if (member.mailboxHealthState === "disabled") blockedReasons.push("Mailbox disabled")
  if (member.throttleStatus === "paused") blockedReasons.push("Mailbox deliverability paused")
  if (member.throttleStatus === "throttled") blockedReasons.push("Mailbox throttled")
  if (member.routingEligible === false) blockedReasons.push("Not eligible for health-aware routing")
  else if (member.mailboxHealthState && !isHealthAwareRoutingEligible(member)) {
    blockedReasons.push("Health-aware routing blocked")
  }

  if (blockedReasons.length === 0) {
    return { eligible: true, blockedReasons: [], primaryReason: "health_score" }
  }

  let primaryReason: GrowthSenderRotationDecisionReason = "health_score"
  if (member.dailyCapRemaining <= 0) primaryReason = "daily_cap_remaining"
  else if (member.mailboxHealthState === "critical" || member.mailboxHealthState === "disabled")
    primaryReason = "mailbox_health"
  else if (member.throttleStatus === "throttled" || member.throttleStatus === "paused")
    primaryReason = "mailbox_health"
  else if (member.senderReputationCritical) primaryReason = "reputation_score"
  else if (member.warmupHealthCritical) primaryReason = "warmup_status"
  else if (member.bounceRisk >= 70) primaryReason = "bounce_risk"
  else if (member.complaintRisk >= 70) primaryReason = "complaint_risk"
  else if (member.recentVolume >= 500) primaryReason = "recent_volume"
  else if (!member.providerRouteAvailable || member.providerHealthScore < 40) primaryReason = "provider_health"
  else if (member.domainDeliverabilityCritical || member.domainHealthScore < 40) primaryReason = "domain_health"

  return { eligible: false, blockedReasons, primaryReason }
}

export function filterEligibleSenderPoolMembers(
  members: GrowthSenderPoolMemberContext[],
  minComplianceScore: number,
  requiresMailbox: boolean,
): GrowthSenderPoolMemberContext[] {
  return members.filter(
    (member) => evaluateSenderPoolMemberEligibility(member, minComplianceScore, requiresMailbox).eligible,
  )
}
