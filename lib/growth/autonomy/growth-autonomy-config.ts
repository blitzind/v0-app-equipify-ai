/** GE-AUTO-1A — Graduated autonomy defaults and capability classification (client-safe). */

import type {
  GrowthAutonomyApprovalPolicy,
  GrowthAutonomyApprovalPolicies,
  GrowthAutonomyBudgetKey,
  GrowthAutonomyCapability,
  GrowthAutonomyCapabilityToggles,
  GrowthAutonomyChannelKey,
  GrowthAutonomyDailyBudgetLimits,
  GrowthAutonomyEnforceableCapability,
  GrowthAutonomyMasterMode,
  GrowthAutonomyOutboundCapability,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { buildDefaultGrowthAutonomyChannelPermissions } from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"

export const GROWTH_AUTONOMY_DEFAULT_MASTER_MODE: GrowthAutonomyMasterMode = "manual"

export const GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY: GrowthAutonomyApprovalPolicy =
  "always_require_approval"

/** Autonomy budget cap of 0 means disabled — unlike GS-RG-1 caps where 0 = unlimited. */
export const GROWTH_AUTONOMY_BUDGET_DISABLED_CAP = 0 as const

export const GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS: GrowthAutonomyDailyBudgetLimits = {
  autonomous_research_runs: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
  autonomous_page_generations: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
  autonomous_video_generations: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
  autonomous_campaigns: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
  autonomous_outbound_actions: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
}

export const GROWTH_AUTONOMY_ASSISTED_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  "research",
  "enrichment",
  "audience_generation",
  "page_generation",
  "video_generation",
  "recommendations",
  "task_creation",
] as const

export const GROWTH_AUTONOMY_GUARDRAILED_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  ...GROWTH_AUTONOMY_ASSISTED_CAPABILITIES,
] as const

export const GROWTH_AUTONOMY_OUTBOUND_CAPABILITIES: readonly GrowthAutonomyOutboundCapability[] = [
  "email_execution",
  "sms_execution",
  "voice_execution",
  "campaign_launch",
] as const

export const GROWTH_AUTONOMY_GENERATION_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  "page_generation",
  "video_generation",
  "audience_generation",
] as const

export const GROWTH_AUTONOMY_ENFORCEABLE_CAPABILITIES: readonly GrowthAutonomyEnforceableCapability[] = [
  "research",
  "enrichment",
  "audience_generation",
  "page_generation",
  "video_generation",
  "recommendations",
  "task_creation",
] as const

export const GROWTH_AUTONOMY_PREPARE_CAPABILITIES: readonly GrowthAutonomyPrepareCapability[] = [
  "email_prepare",
  "sms_prepare",
  "voice_prepare",
] as const

export const GROWTH_AUTONOMY_EDITABLE_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  "research",
  "enrichment",
  "audience_generation",
  "page_generation",
  "video_generation",
  "recommendations",
  "task_creation",
  "campaign_launch",
  "strategy_adaptation",
] as const

export const GROWTH_AUTONOMY_LOCKED_OUTBOUND_CAPABILITIES: readonly GrowthAutonomyCapability[] = [
  "email_execution",
  "sms_execution",
  "voice_execution",
] as const

export const GROWTH_AUTONOMY_LOCKED_BUDGET_KEYS: readonly GrowthAutonomyBudgetKey[] = [
  "autonomous_outbound_actions",
] as const

export const GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS: readonly GrowthAutonomyBudgetKey[] = [
  "autonomous_research_runs",
  "autonomous_page_generations",
  "autonomous_video_generations",
  "autonomous_campaigns",
] as const

export const GROWTH_AUTONOMY_MAX_DAILY_BUDGET = 10_000 as const

export const GROWTH_AUTONOMY_CAPABILITY_LABELS: Record<GrowthAutonomyCapability, string> = {
  research: "Research",
  enrichment: "Enrichment",
  audience_generation: "Audience generation",
  page_generation: "Page generation",
  video_generation: "Video generation",
  recommendations: "Recommendations",
  task_creation: "Task creation",
  email_execution: "Email execution",
  sms_execution: "SMS execution",
  voice_execution: "Voice execution",
  campaign_launch: "Campaign launch",
  strategy_adaptation: "Strategy adaptation",
}

export const GROWTH_AUTONOMY_MASTER_MODE_LABELS: Record<GrowthAutonomyMasterMode, string> = {
  manual: "Manual",
  assisted: "Assisted",
  guardrailed: "Guardrailed",
  channel: "Channel",
  objective: "Objective",
}

export const GROWTH_AUTONOMY_MASTER_MODE_DESCRIPTIONS: Record<GrowthAutonomyMasterMode, string> = {
  manual: "Everything requires human approval. Current production behavior.",
  assisted: "AI may research, enrich, and generate — outbound still requires approval.",
  guardrailed: "Low-risk internal actions may run automatically — outbound blocked.",
  channel: "Per-channel prepare controls — drafts queue for approval; sending remains locked.",
  objective: "Future planner mode — visible in GE-AUTO-1C, execution remains disabled.",
}

export const GROWTH_AUTONOMY_APPROVAL_POLICY_LABELS: Record<GrowthAutonomyApprovalPolicy, string> = {
  always_require_approval: "Always require approval",
  conditional_approval: "Conditional approval",
  fully_autonomous: "Fully autonomous",
}

export const GROWTH_AUTONOMY_BUDGET_LABELS: Record<GrowthAutonomyBudgetKey, string> = {
  autonomous_research_runs: "Autonomous research runs",
  autonomous_page_generations: "Autonomous page generations",
  autonomous_video_generations: "Autonomous video generations",
  autonomous_campaigns: "Autonomous campaigns",
  autonomous_outbound_actions: "Autonomous outbound actions",
}

export const GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET: Partial<
  Record<GrowthAutonomyCapability, GrowthAutonomyBudgetKey>
> = {
  research: "autonomous_research_runs",
  enrichment: "autonomous_research_runs",
  page_generation: "autonomous_page_generations",
  video_generation: "autonomous_video_generations",
  campaign_launch: "autonomous_campaigns",
  email_execution: "autonomous_outbound_actions",
  sms_execution: "autonomous_outbound_actions",
  voice_execution: "autonomous_outbound_actions",
}

export function isGrowthAutonomyEnforceableCapability(
  capability: GrowthAutonomyCapability,
): capability is GrowthAutonomyEnforceableCapability {
  return (GROWTH_AUTONOMY_ENFORCEABLE_CAPABILITIES as readonly string[]).includes(capability)
}

export const GROWTH_AUTONOMY_CAPABILITY_TO_CHANNEL: Partial<
  Record<GrowthAutonomyCapability, GrowthAutonomyChannelKey>
> = {
  email_execution: "email",
  sms_execution: "sms",
  voice_execution: "voice",
}

export function buildDefaultGrowthAutonomyCapabilityToggles(): GrowthAutonomyCapabilityToggles {
  return {
    research: false,
    enrichment: false,
    audience_generation: false,
    page_generation: false,
    video_generation: false,
    recommendations: false,
    task_creation: false,
    email_execution: false,
    sms_execution: false,
    voice_execution: false,
    campaign_launch: false,
    strategy_adaptation: false,
  }
}

export function buildDefaultGrowthAutonomyApprovalPolicies(): GrowthAutonomyApprovalPolicies {
  const policies: GrowthAutonomyApprovalPolicies = {}
  for (const capability of Object.keys(buildDefaultGrowthAutonomyCapabilityToggles()) as GrowthAutonomyCapability[]) {
    policies[capability] = GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
  }
  return policies
}

export function buildDefaultGrowthAutonomySettings(organizationId: string): GrowthAutonomySettings {
  return {
    organizationId,
    masterMode: GROWTH_AUTONOMY_DEFAULT_MASTER_MODE,
    capabilityToggles: buildDefaultGrowthAutonomyCapabilityToggles(),
    approvalPolicies: buildDefaultGrowthAutonomyApprovalPolicies(),
    channelPermissions: buildDefaultGrowthAutonomyChannelPermissions(),
    dailyBudgetLimits: { ...GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS },
    updatedAt: null,
  }
}

export function isGrowthAutonomyPrepareCapability(
  capability: string,
): capability is GrowthAutonomyPrepareCapability {
  return (GROWTH_AUTONOMY_PREPARE_CAPABILITIES as readonly string[]).includes(capability)
}

export function isPrepareCapabilityPermittedByMasterMode(
  masterMode: GrowthAutonomyMasterMode,
): boolean {
  return masterMode === "assisted" || masterMode === "guardrailed" || masterMode === "channel"
}

export function isGrowthAutonomyOutboundCapability(
  capability: GrowthAutonomyCapability,
): capability is GrowthAutonomyOutboundCapability {
  return (GROWTH_AUTONOMY_OUTBOUND_CAPABILITIES as readonly string[]).includes(capability)
}

export function isGrowthAutonomyGenerationCapability(capability: GrowthAutonomyCapability): boolean {
  return (GROWTH_AUTONOMY_GENERATION_CAPABILITIES as readonly string[]).includes(capability)
}

export function resolveEffectiveAutonomyApprovalPolicy(
  capability: GrowthAutonomyCapability,
  configured: GrowthAutonomyApprovalPolicy | undefined,
): GrowthAutonomyApprovalPolicy {
  if (isGrowthAutonomyOutboundCapability(capability)) {
    return GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
  }
  if (configured === "fully_autonomous") {
    return GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
  }
  return configured ?? GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
}

export function isCapabilityPermittedByMasterMode(
  masterMode: GrowthAutonomyMasterMode,
  capability: GrowthAutonomyCapability,
): boolean {
  if (masterMode === "manual") return false
  if (masterMode === "objective") {
    return capability === "strategy_adaptation" || capability === "recommendations"
  }
  if (masterMode === "channel") {
    return (
      isGrowthAutonomyOutboundCapability(capability) ||
      (GROWTH_AUTONOMY_ASSISTED_CAPABILITIES as readonly string[]).includes(capability)
    )
  }
  if (masterMode === "assisted") {
    return (GROWTH_AUTONOMY_ASSISTED_CAPABILITIES as readonly string[]).includes(capability)
  }
  if (masterMode === "guardrailed") {
    return (GROWTH_AUTONOMY_GUARDRAILED_CAPABILITIES as readonly string[]).includes(capability)
  }
  return false
}
