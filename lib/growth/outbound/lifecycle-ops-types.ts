/** Client-safe types for outbound lifecycle operations (Phase 4). */

export const GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER = "growth-outbound-lifecycle-ops-v1" as const

export const GROWTH_INBOX_LIFECYCLE_STAGES = [
  "provisioning",
  "warming",
  "active",
  "elevated_risk",
  "cooling_down",
  "paused",
  "retired",
] as const
export type GrowthInboxLifecycleStage = (typeof GROWTH_INBOX_LIFECYCLE_STAGES)[number]

export const GROWTH_MAINTENANCE_TASK_TYPES = [
  "cooldown_recommended",
  "send_reduction",
  "inactive_sender",
  "stale_inbox",
  "oauth_refresh_warning",
  "unhealthy_sender_isolation",
  "sender_redistribution",
  "dns_issue",
  "domain_rotation",
  "domain_cooldown",
  "retirement_candidate",
] as const
export type GrowthMaintenanceTaskType = (typeof GROWTH_MAINTENANCE_TASK_TYPES)[number]

export const GROWTH_OPERATIONAL_ALERT_CATEGORIES = [
  "dns_failure",
  "oauth_failure",
  "complaint_spike",
  "bounce_spike",
  "sender_degradation",
  "pool_saturation",
  "queue_congestion",
  "webhook_outage",
  "throughput_risk",
  "infrastructure_imbalance",
] as const
export type GrowthOperationalAlertCategory = (typeof GROWTH_OPERATIONAL_ALERT_CATEGORIES)[number]

export type GrowthInboxLifecycleRow = {
  senderAccountId: string
  mailboxConnectionId: string | null
  emailAddress: string
  domain: string
  lifecycleStage: GrowthInboxLifecycleStage
  lifecycleStageOverride: boolean
  inboxAgeDays: number | null
  domainAgeNote: string | null
  lastSendAt: string | null
  inactivityDays: number | null
  fatigueScore: number
  trustScore: number
  pauseCount30d: number
  complaintCount30d: number
  recommendations: string[]
  retirementCandidate: boolean
}

export type GrowthMaintenanceTaskRow = {
  id: string
  taskType: string
  severity: string
  title: string
  summary: string | null
  status: string
  recommendationOnly: boolean
  createdAt: string
}

export type GrowthOperationalAlertRow = {
  id: string
  category: string
  severity: string
  title: string
  summary: string | null
  acknowledged: boolean
  createdAt: string
}

export type GrowthInfrastructureInventorySummary = {
  totalDomains: number
  totalMailboxes: number
  activeSenders: number
  pausedSenders: number
  retiredSenders: number
  warmingSenders: number
  availableDailyCapacity: number
  usedDailyCapacity: number
}

export type GrowthInfrastructureSustainabilityMetrics = {
  avgInboxAgeDays: number
  agingSenderCount: number
  coolingDomainCount: number
  retirementCandidateCount: number
  inactiveInfrastructureCount: number
  operationalInterventions30d: number
  riskAccumulationScore: number
}

export type GrowthInfrastructureFitAssessment = {
  infrastructureFitScore: number
  launchReadinessScore: number
  recommendations: string[]
  blockers: string[]
  advisoryOnly: true
}
