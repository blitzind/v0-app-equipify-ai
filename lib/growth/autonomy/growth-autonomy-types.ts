/** GE-AUTO-1A/1B/1C — Graduated autonomy configuration and policy types (client-safe). */

export const GROWTH_AUTONOMY_QA_MARKER = "growth-autonomy-ge-auto-1c-v1" as const

export const GROWTH_AUTONOMY_PHASE = "GE-AUTO-1C" as const

export type GrowthAutonomyTriggerSource = "operator" | "autonomous"

export const GROWTH_AUTONOMY_SCHEMA_MIGRATION =
  "20270927140000_growth_autonomy_ge_auto_1a.sql" as const

/** Level 0 — MANUAL */
export type GrowthAutonomyMasterMode = "manual" | "assisted" | "guardrailed" | "channel" | "objective"

export const GROWTH_AUTONOMY_MASTER_MODES: readonly GrowthAutonomyMasterMode[] = [
  "manual",
  "assisted",
  "guardrailed",
  "channel",
  "objective",
] as const

export type GrowthAutonomyCapability =
  | "research"
  | "enrichment"
  | "audience_generation"
  | "page_generation"
  | "video_generation"
  | "recommendations"
  | "task_creation"
  | "email_execution"
  | "sms_execution"
  | "voice_execution"
  | "campaign_launch"
  | "strategy_adaptation"

export const GROWTH_AUTONOMY_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  "research",
  "enrichment",
  "audience_generation",
  "page_generation",
  "video_generation",
  "recommendations",
  "task_creation",
  "email_execution",
  "sms_execution",
  "voice_execution",
  "campaign_launch",
  "strategy_adaptation",
] as const

export type GrowthAutonomyInternalCapability = Extract<
  GrowthAutonomyCapability,
  | "research"
  | "enrichment"
  | "audience_generation"
  | "page_generation"
  | "video_generation"
  | "recommendations"
  | "task_creation"
  | "strategy_adaptation"
>

/** Safe internal capabilities that GE-AUTO-1B may enforce for autonomous triggers. */
export type GrowthAutonomyEnforceableCapability = Extract<
  GrowthAutonomyInternalCapability,
  | "research"
  | "enrichment"
  | "audience_generation"
  | "page_generation"
  | "video_generation"
  | "recommendations"
  | "task_creation"
>

export type GrowthAutonomyOutboundCapability = Extract<
  GrowthAutonomyCapability,
  "email_execution" | "sms_execution" | "voice_execution" | "campaign_launch"
>

export type GrowthAutonomyApprovalPolicy =
  | "always_require_approval"
  | "conditional_approval"
  | "fully_autonomous"

export const GROWTH_AUTONOMY_APPROVAL_POLICIES: readonly GrowthAutonomyApprovalPolicy[] = [
  "always_require_approval",
  "conditional_approval",
  "fully_autonomous",
] as const

export type GrowthAutonomyChannelKey = "email" | "sms" | "voice"

export type GrowthAutonomyQuietHours = {
  enabled: boolean
  startHourUtc: number
  endHourUtc: number
}

export type GrowthAutonomyChannelPrepareConfig = {
  enabled_for_prepare: boolean
  max_prepared_per_day: number
  allowed_sender_profiles: string[]
  allowed_sequences: string[]
  allowed_audiences: string[]
  minimum_confidence_score: number
  quiet_hours: GrowthAutonomyQuietHours
  /** Legacy GE-AUTO-1A field — mirrored from enabled_for_prepare when reading. */
  enabled?: boolean
  approvalPolicy?: GrowthAutonomyApprovalPolicy
}

export type GrowthAutonomyPrepareCapability = "email_prepare" | "sms_prepare" | "voice_prepare"

export const GROWTH_AUTONOMY_PREPARE_CAPABILITIES: readonly GrowthAutonomyPrepareCapability[] = [
  "email_prepare",
  "sms_prepare",
  "voice_prepare",
] as const

export type GrowthAutonomyPrepareContext = {
  senderProfileId?: string | null
  sequenceId?: string | null
  audienceId?: string | null
  confidenceScore?: number | null
  now?: Date
}

export type GrowthAutonomyChannelPolicyMetadata = {
  channel: GrowthAutonomyChannelKey
  prepareEnabled: boolean
  quietHoursActive: boolean
  confidenceMet: boolean
  senderAllowed: boolean
  sequenceAllowed: boolean
  audienceAllowed: boolean
  outboundSendBlocked: true
  maxPreparedPerDay: number
  preparedToday: number
  minimumConfidenceScore: number
  confidenceScore: number | null
}

/** @deprecated Use GrowthAutonomyChannelPrepareConfig */
export type GrowthAutonomyChannelPermission = {
  enabled: boolean
  approvalPolicy: GrowthAutonomyApprovalPolicy
}

export type GrowthAutonomyChannelPermissions = Partial<
  Record<GrowthAutonomyChannelKey, GrowthAutonomyChannelPrepareConfig>
>

export type GrowthAutonomyCapabilityToggles = Partial<Record<GrowthAutonomyCapability, boolean>>

export type GrowthAutonomyApprovalPolicies = Partial<
  Record<GrowthAutonomyCapability, GrowthAutonomyApprovalPolicy>
>

export type GrowthAutonomyBudgetKey =
  | "autonomous_research_runs"
  | "autonomous_page_generations"
  | "autonomous_video_generations"
  | "autonomous_campaigns"
  | "autonomous_outbound_actions"

export const GROWTH_AUTONOMY_BUDGET_KEYS: readonly GrowthAutonomyBudgetKey[] = [
  "autonomous_research_runs",
  "autonomous_page_generations",
  "autonomous_video_generations",
  "autonomous_campaigns",
  "autonomous_outbound_actions",
] as const

export type GrowthAutonomyDailyBudgetLimits = Partial<Record<GrowthAutonomyBudgetKey, number>>

export type GrowthAutonomySettings = {
  organizationId: string
  masterMode: GrowthAutonomyMasterMode
  capabilityToggles: GrowthAutonomyCapabilityToggles
  approvalPolicies: GrowthAutonomyApprovalPolicies
  channelPermissions: GrowthAutonomyChannelPermissions
  dailyBudgetLimits: GrowthAutonomyDailyBudgetLimits
  updatedAt: string | null
}

export type GrowthAutonomyPolicyMetadata = {
  masterMode: GrowthAutonomyMasterMode
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
  capabilityEnabled: boolean
  approvalPolicy: GrowthAutonomyApprovalPolicy
  killSwitchState: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    autonomyGenerationEnabled: boolean
    autonomyObjectiveModeEnabled: boolean
  }
  budgetState: {
    resourceType: GrowthAutonomyBudgetKey | string | null
    cap: number
    remaining: number
    exceeded: boolean
  }
  channelPermission: GrowthAutonomyChannelPrepareConfig | null
  channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata | null
  phase: typeof GROWTH_AUTONOMY_PHASE
  enforcementActive: boolean
  triggerSource: GrowthAutonomyTriggerSource
}

export type GrowthAutonomyPolicyResult = {
  allowed: boolean
  blocked: boolean
  requiresApproval: boolean
  reason: string | null
  policyMetadata: GrowthAutonomyPolicyMetadata
}

export type GrowthAutonomySettingsSnapshot = GrowthAutonomySettings & {
  killSwitches: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    autonomyGenerationEnabled: boolean
    autonomyObjectiveModeEnabled: boolean
  }
}
