/** GE-AUTO-2G — Objective-driven planning & runtime types (client-safe). */

import type { GrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-types"

export const GROWTH_OBJECTIVE_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_PHASE = "GE-AUTO-2G" as const

export const GROWTH_OBJECTIVE_RUNTIME_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_EVENT_SUBSCRIPTIONS_QA_MARKER =
  "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_SCHEMA_MIGRATION =
  "20270929140000_growth_autonomy_ge_auto_1f.sql" as const

export const GROWTH_OBJECTIVE_RUNTIME_SCHEMA_MIGRATION =
  "20270930140000_growth_objective_ge_auto_2a.sql" as const

export const GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION =
  "20270931140000_growth_objective_ge_auto_2b.sql" as const

export const GROWTH_OBJECTIVE_PRODUCTION_SCHEMA_MIGRATION =
  "20270932150000_growth_objective_ge_auto_2d.sql" as const

export const GROWTH_OBJECTIVE_EXECUTION_CONTEXT_SCHEMA_MIGRATION =
  "20270933150000_growth_objective_ge_auto_2e.sql" as const

export const GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_PRODUCTION_FANIN_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_PRODUCTION_DEDUPE_QA_MARKER = "growth-objective-ge-auto-2g-v1" as const

export const GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER =
  "growth-objective-ge-auto-2g-v1" as const

export type GrowthObjectiveType =
  | "demos_booked"
  | "meetings_booked"
  | "opportunities_created"
  | "pipeline_value"
  | "customers_acquired"
  | "custom"

export const GROWTH_OBJECTIVE_TYPES: readonly GrowthObjectiveType[] = [
  "demos_booked",
  "meetings_booked",
  "opportunities_created",
  "pipeline_value",
  "customers_acquired",
  "custom",
] as const

export type GrowthObjectiveStatus =
  | "draft"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "archived"

export const GROWTH_OBJECTIVE_STATUSES: readonly GrowthObjectiveStatus[] = [
  "draft",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const

export type GrowthObjectivePriority = "low" | "medium" | "high" | "critical"

export type GrowthObjectiveAutonomyLevel =
  | "manual"
  | "assisted"
  | "guardrailed"
  | "channel"
  | "objective"

export type GrowthObjectiveSafetyMode = "strict" | "balanced" | "shadow"

export type GrowthObjectiveStageId =
  | "discover"
  | "research"
  | "enrich"
  | "buying_committee"
  | "generate_assets"
  | "launch"
  | "monitor"
  | "adapt"
  | "book"
  | "complete"

export const GROWTH_OBJECTIVE_STAGE_IDS: readonly GrowthObjectiveStageId[] = [
  "discover",
  "research",
  "enrich",
  "buying_committee",
  "generate_assets",
  "launch",
  "monitor",
  "adapt",
  "book",
  "complete",
] as const

export type GrowthObjectiveStageStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "complete"
  | "skipped"

/** GE-AUTO-2A — persisted runtime stage states (distinct from planner view). */
export type GrowthObjectiveRuntimeStageState =
  | "pending"
  | "running"
  | "blocked"
  | "paused"
  | "completed"
  | "failed"

export const GROWTH_OBJECTIVE_RUNTIME_STAGE_STATES: readonly GrowthObjectiveRuntimeStageState[] = [
  "pending",
  "running",
  "blocked",
  "paused",
  "completed",
  "failed",
] as const

export type GrowthObjectiveRuntimeStageRecord = {
  state: GrowthObjectiveRuntimeStageState
  startedAt: string | null
  completedAt: string | null
  lastError: string | null
  progress: number
  blockers: string[]
}

export type GrowthObjectiveSchedulerLastResult = {
  ticksAttempted: number
  retriesAttempted: number
  stalledDetected: boolean
  failed: boolean
  at: string
}

export type GrowthObjectiveRuntimeState = {
  qa_marker: typeof GROWTH_OBJECTIVE_RUNTIME_QA_MARKER
  currentStageId: GrowthObjectiveStageId
  stageStates: Record<GrowthObjectiveStageId, GrowthObjectiveRuntimeStageRecord>
  startedAt: string | null
  lastTickAt: string | null
  stoppedAt: string | null
  estimatedCompletionDate: string | null
  running: boolean
  lastSignalAt?: string | null
  lastProgressAt?: string | null
  stalledSince?: string | null
  lastSchedulerAt?: string | null
  schedulerRunCount?: number
  schedulerRetryAttempts?: number
  lastSchedulerResult?: GrowthObjectiveSchedulerLastResult | null
}

export type GrowthObjectiveSourceEventResourceType =
  | "saved_search"
  | "audience"
  | "campaign"
  | "landing_page"
  | "video_page"
  | "sequence"
  | "booking_page"
  | "opportunity"
  | "research_run"
  | "enrichment_run"

export type GrowthObjectiveMaterializedArtifactStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"

export type GrowthObjectiveMaterializedArtifact = {
  resourceType: GrowthObjectiveSourceEventResourceType
  resourceId: string
  resourceKey: string
  label: string
  status: GrowthObjectiveMaterializedArtifactStatus
  createdAt: string
  metadata?: Record<string, unknown>
}

export type GrowthObjectiveStageExecutionContext = {
  materializedAt: string | null
  completedAt: string | null
  artifacts: GrowthObjectiveMaterializedArtifact[]
  blockers: string[]
}

export type GrowthObjectiveExecutionContext = {
  qa_marker: typeof GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER
  version: 1
  stages: Partial<Record<GrowthObjectiveStageId, GrowthObjectiveStageExecutionContext>>
  recoveredAt: string | null
}

export type GrowthObjectiveEventSubscription = {
  id: string
  resourceType: GrowthObjectiveSourceEventResourceType
  resourceKey: string
  /** Real resource UUID when known (GE-AUTO-2C). */
  resourceId?: string | null
  label: string
}

export type GrowthObjectiveEventSubscriptions = {
  qa_marker: typeof GROWTH_OBJECTIVE_EVENT_SUBSCRIPTIONS_QA_MARKER
  items: GrowthObjectiveEventSubscription[]
  subscribedAt: string
}

export type GrowthObjectiveSignalSnapshot = {
  opens: number
  clicks: number
  replies: number
  videoViews: number
  videoCompletions: number
  bookings: number
  opportunities: number
  customers: number
  engagementScore: number
  intentScore: number
  sequenceReplyRate: number
  sequenceOpenRate: number
}

export type GrowthObjectiveExecutionHistoryEntry = {
  id: string
  ts: string
  stageId: GrowthObjectiveStageId
  action: string
  outcome: "success" | "blocked" | "skipped" | "failed"
  reason: string | null
  policyGated: boolean
  capability: GrowthAutonomyCapability | null
  signalType?: string
  detail?: string | null
}

export type GrowthObjectiveInboundSignal = {
  type:
    | "engagement_open"
    | "engagement_click"
    | "reply"
    | "video_view"
    | "video_completion"
    | "booking_completed"
    | "meeting_booked"
    | "automation_event"
    | "sequence_event"
    | "opportunity_created"
    | "customer_closed"
  ts?: string
  value?: number
  leadId?: string | null
  payload?: Record<string, unknown>
}

export type GrowthObjectiveRecentSignal = GrowthObjectiveInboundSignal & {
  id: string
  receivedAt: string
}

export type GrowthObjectiveIcpStrategy = {
  industries: string[]
  companySize: string | null
  geography: string | null
  keywords: string[]
  persona: string | null
  summary: string
}

export type GrowthObjectivePlanStage = {
  id: GrowthObjectiveStageId
  label: string
  status: GrowthObjectiveStageStatus
  progress: number
  blockers: string[]
  recommendations: string[]
  confidence: number
}

export type GrowthObjectiveForecast = {
  leadsNeeded: number
  audienceSizeRequired: number
  assetsRequired: number
  estimatedSends: number
  estimatedOutcomes: number
  estimatedDays: number
  assumptions: string[]
}

export type GrowthObjectiveExecutionPlan = {
  objectiveId: string
  generatedAt: string
  qa_marker: typeof GROWTH_OBJECTIVE_QA_MARKER
  icpStrategy: GrowthObjectiveIcpStrategy
  savedSearches: Array<{ name: string; query: string; rationale: string }>
  audiences: Array<{ name: string; criteria: string; rationale: string }>
  researchRequirements: string[]
  buyingCommitteeRequirements: string[]
  assetsRequired: Array<{
    type: "page" | "video" | "demo_assistant" | "template" | "sequence"
    name: string
    rationale: string
  }>
  channelsRequired: Array<"email" | "sms" | "voice">
  automationPlaybooks: Array<{ name: string; trigger: string; rationale: string }>
  successMetrics: string[]
  stages: GrowthObjectivePlanStage[]
  forecast: GrowthObjectiveForecast
}

export type GrowthObjectiveAdaptiveRecommendation = {
  id: string
  objectiveId: string
  trigger: string
  signal: string
  recommendation: string
  suggestedCapability: GrowthAutonomyCapability | null
  priority: GrowthObjectivePriority
  requiresApproval: true
  createdAt: string
}

export type GrowthObjective = {
  id: string
  organizationId: string
  title: string
  description: string | null
  objectiveType: GrowthObjectiveType
  targetValue: number
  currentValue: number
  startDate: string | null
  targetDate: string | null
  status: GrowthObjectiveStatus
  ownerUserId: string | null
  priority: GrowthObjectivePriority
  autonomyLevel: GrowthObjectiveAutonomyLevel
  safetyMode: GrowthObjectiveSafetyMode
  plan: GrowthObjectiveExecutionPlan | null
  runtime: GrowthObjectiveRuntimeState | null
  executionHistory: GrowthObjectiveExecutionHistoryEntry[]
  recentSignals: GrowthObjectiveRecentSignal[]
  recommendations: GrowthObjectiveAdaptiveRecommendation[]
  eventSubscriptions: GrowthObjectiveEventSubscriptions | null
  executionContext: GrowthObjectiveExecutionContext | null
  emergencyStopActive: boolean
  qa_marker: typeof GROWTH_OBJECTIVE_QA_MARKER
  createdAt: string
  updatedAt: string
}

export type GrowthObjectiveCreateInput = {
  title: string
  description?: string | null
  objectiveType: GrowthObjectiveType
  targetValue: number
  startDate?: string | null
  targetDate?: string | null
  ownerUserId?: string | null
  priority?: GrowthObjectivePriority
  autonomyLevel?: GrowthObjectiveAutonomyLevel
  safetyMode?: GrowthObjectiveSafetyMode
}

export type GrowthObjectiveOrchestrationRequest = {
  capability: GrowthAutonomyCapability
  runtimeContext: string
  label: string
}

export type GrowthObjectiveOrchestrationResult = {
  capability: GrowthAutonomyCapability
  label: string
  allowed: boolean
  blocked: boolean
  reason: string | null
  requiresApproval: boolean
}

/** Client-safe dashboard payload shape returned by objectives API routes. */
export type GrowthObjectiveDashboardModel = {
  qa_marker: typeof GROWTH_OBJECTIVE_QA_MARKER
  runtime_qa_marker: typeof GROWTH_OBJECTIVE_RUNTIME_QA_MARKER
  objectives: GrowthObjective[]
  activeCount: number
  pausedCount: number
  runningCount: number
  totalTarget: number
  totalProgress: number
  emergencyStopActive: boolean
  objectiveModeEnabled: boolean
}
