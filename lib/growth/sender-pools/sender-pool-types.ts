/** Client-safe Growth Engine sender pool intelligence types (Phase 2Q). */

export const GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER = "growth-sender-pool-intelligence-v1" as const

export const GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE =
  "Sender pool rotation is platform-admin only. Human approval required for every send — no autonomous bypass, no compliance bypass, no hidden sends, no raw provider credentials."

export const GROWTH_SENDER_POOL_STATUSES = ["draft", "active", "paused", "disabled"] as const
export type GrowthSenderPoolStatus = (typeof GROWTH_SENDER_POOL_STATUSES)[number]

export const GROWTH_SENDER_POOL_ROTATION_STRATEGIES = [
  "round_robin",
  "weighted_health",
  "lowest_volume",
  "best_reputation",
  "warmup_safe",
  "manual_priority",
] as const
export type GrowthSenderPoolRotationStrategy = (typeof GROWTH_SENDER_POOL_ROTATION_STRATEGIES)[number]

export const GROWTH_SENDER_POOL_MEMBER_STATUSES = [
  "eligible",
  "cooldown",
  "paused",
  "blocked",
  "warming",
  "degraded",
] as const
export type GrowthSenderPoolMemberStatus = (typeof GROWTH_SENDER_POOL_MEMBER_STATUSES)[number]

export const GROWTH_SENDER_ROTATION_DECISION_REASONS = [
  "daily_cap_remaining",
  "health_score",
  "reputation_score",
  "warmup_status",
  "bounce_risk",
  "complaint_risk",
  "recent_volume",
  "provider_health",
  "domain_health",
  "manual_override",
] as const
export type GrowthSenderRotationDecisionReason = (typeof GROWTH_SENDER_ROTATION_DECISION_REASONS)[number]

export const GROWTH_SENDER_FATIGUE_TYPES = [
  "high_recent_volume",
  "reply_collapse",
  "bounce_spike",
  "complaint_spike",
  "open_click_collapse",
  "warmup_mismatch",
  "provider_degradation",
] as const
export type GrowthSenderFatigueType = (typeof GROWTH_SENDER_FATIGUE_TYPES)[number]

export const GROWTH_SENDER_ROTATION_RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type GrowthSenderRotationRiskLevel = (typeof GROWTH_SENDER_ROTATION_RISK_LEVELS)[number]

export type GrowthSenderPool = {
  id: string
  name: string
  description: string
  status: GrowthSenderPoolStatus
  rotationStrategy: GrowthSenderPoolRotationStrategy
  dailyPoolCap: number | null
  requiresMailbox: boolean
  minComplianceScore: number
  allowAutoRotation: boolean
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type GrowthSenderPoolMember = {
  id: string
  senderPoolId: string
  senderAccountId: string
  senderLabel: string
  senderEmail: string
  memberStatus: GrowthSenderPoolMemberStatus
  priorityWeight: number
  manualPriority: number
  lastSelectedAt: string | null
  cooldownUntil: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type GrowthSenderRotationFallbackCandidate = {
  senderAccountId: string
  senderLabel: string
  reason: GrowthSenderRotationDecisionReason
  riskLevel: GrowthSenderRotationRiskLevel
}

export type GrowthSenderRotationDecision = {
  id: string
  senderPoolId: string
  senderPoolName: string
  sequenceExecutionJobId: string | null
  deliveryAttemptId: string | null
  selectedSenderAccountId: string | null
  selectedSenderLabel: string | null
  selectedProviderId: string | null
  selectedRouteId: string | null
  decisionReason: GrowthSenderRotationDecisionReason
  riskLevel: GrowthSenderRotationRiskLevel
  allowAutoRotation: boolean
  fallbackCandidates: GrowthSenderRotationFallbackCandidate[]
  createdAt: string
}

export type GrowthSenderFatigueEvent = {
  id: string
  senderAccountId: string
  senderLabel: string
  senderPoolId: string | null
  senderPoolName: string | null
  fatigueType: GrowthSenderFatigueType
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
  resolved: boolean
  createdAt: string
}

export type GrowthSenderPoolPerformanceSnapshot = {
  id: string
  senderPoolId: string
  senderPoolName: string
  eligibleMembers: number
  cooldownMembers: number
  fatigueWarnings: number
  averageReputation: number
  rotationHealthScore: number
  recordedAt: string
}

export type GrowthSenderPoolDashboard = {
  qa_marker: typeof GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER
  activePools: number
  eligibleSenders: number
  sendersInCooldown: number
  fatigueWarnings: number
  averageReputation: number
  rotationHealth: number
  pools: GrowthSenderPool[]
  members: GrowthSenderPoolMember[]
  rotationDecisions: GrowthSenderRotationDecision[]
  fatigueEvents: GrowthSenderFatigueEvent[]
  performanceSnapshots: GrowthSenderPoolPerformanceSnapshot[]
}

export type GrowthSenderRotationOutput = {
  selectedSenderAccountId: string | null
  selectedProviderId: string | null
  selectedRouteId: string | null
  reason: GrowthSenderRotationDecisionReason
  riskLevel: GrowthSenderRotationRiskLevel
  fallbackSenderCandidates: GrowthSenderRotationFallbackCandidate[]
}

export type GrowthSenderPoolMemberContext = {
  memberId: string
  senderAccountId: string
  senderLabel: string
  senderEmail: string
  memberStatus: GrowthSenderPoolMemberStatus
  priorityWeight: number
  manualPriority: number
  lastSelectedAt: string | null
  cooldownUntil: string | null
  senderConnected: boolean
  mailboxConnected: boolean
  suppressed: boolean
  disabled: boolean
  warmupHealthCritical: boolean
  senderReputationCritical: boolean
  domainDeliverabilityCritical: boolean
  dailyCapRemaining: number
  providerRouteAvailable: boolean
  complianceScore: number
  healthScore: number
  reputationScore: number
  recentVolume: number
  bounceRisk: number
  complaintRisk: number
  providerHealthScore: number
  domainHealthScore: number
  warmupProgress: number
}

export function poolStatusLabel(status: GrowthSenderPoolStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "active":
      return "Active"
    case "paused":
      return "Paused"
    case "disabled":
      return "Disabled"
    default:
      return status
  }
}

export function rotationStrategyLabel(strategy: GrowthSenderPoolRotationStrategy): string {
  switch (strategy) {
    case "round_robin":
      return "Round robin"
    case "weighted_health":
      return "Weighted health"
    case "lowest_volume":
      return "Lowest volume"
    case "best_reputation":
      return "Best reputation"
    case "warmup_safe":
      return "Warmup safe"
    case "manual_priority":
      return "Manual priority"
    default:
      return strategy
  }
}

export function memberStatusLabel(status: GrowthSenderPoolMemberStatus): string {
  switch (status) {
    case "eligible":
      return "Eligible"
    case "cooldown":
      return "Cooldown"
    case "paused":
      return "Paused"
    case "blocked":
      return "Blocked"
    case "warming":
      return "Warming"
    case "degraded":
      return "Degraded"
    default:
      return status
  }
}

export function rotationReasonLabel(reason: GrowthSenderRotationDecisionReason): string {
  switch (reason) {
    case "daily_cap_remaining":
      return "Daily cap remaining"
    case "health_score":
      return "Health score"
    case "reputation_score":
      return "Reputation score"
    case "warmup_status":
      return "Warmup status"
    case "bounce_risk":
      return "Bounce risk"
    case "complaint_risk":
      return "Complaint risk"
    case "recent_volume":
      return "Recent volume"
    case "provider_health":
      return "Provider health"
    case "domain_health":
      return "Domain health"
    case "manual_override":
      return "Manual override"
    default:
      return reason
  }
}

export function riskLevelLabel(level: GrowthSenderRotationRiskLevel): string {
  switch (level) {
    case "low":
      return "Low"
    case "medium":
      return "Medium"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return level
  }
}

export function fatigueTypeLabel(type: GrowthSenderFatigueType): string {
  return type.replace(/_/g, " ")
}

export function maskSenderLabel(email: string, displayName?: string | null): string {
  const name = (displayName ?? "").trim()
  if (name) return name.slice(0, 80)
  const at = email.indexOf("@")
  if (at <= 1) return "Sender"
  return `${email.slice(0, 1)}***${email.slice(at)}`
}
