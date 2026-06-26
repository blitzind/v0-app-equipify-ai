/** GE-AIOS-CONSOLIDATION-1C/1E — Autonomy Policy Engine read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  type GrowthAiOsAutonomyPolicyBuildInput,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import type {
  GrowthAiOsAutonomyPolicyEvaluationContext,
  GrowthAiOsAutonomyPolicyReadModel,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type {
  GrowthAutonomyBudgetKey,
  GrowthAutonomyCapability,
  GrowthAutonomySettingsSnapshot,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { getAutonomousExecutionPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import { getAutonomousPlanningPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-store"
import { getAutonomousQualificationPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-store"
import { getAutonomousResearchPilotOrgState } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-store"
import {
  resolveExecutionRuntimeEnabled,
  resolveExecutionRuntimePilotEnabled,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

function nowIso(): string {
  return new Date().toISOString()
}

async function buildSettingsSnapshot(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAutonomySettingsSnapshot> {
  const settings = await fetchGrowthAutonomySettings(admin, organizationId)
  const killSwitchStates = await getRuntimeKillSwitchStates(admin)
  return {
    ...settings,
    killSwitches: {
      autonomyEnabled: Boolean(killSwitchStates.autonomy_enabled),
      autonomyOutboundEnabled: Boolean(killSwitchStates.autonomy_outbound_enabled),
      autonomyGenerationEnabled: Boolean(killSwitchStates.autonomy_generation_enabled),
      autonomyObjectiveModeEnabled: Boolean(killSwitchStates.autonomy_objective_mode_enabled),
    },
  }
}

const GROWTH_AUTONOMY_BUDGET_KEY_TO_CAPABILITY: Record<GrowthAutonomyBudgetKey, GrowthAutonomyCapability> = {
  autonomous_research_runs: "research",
  autonomous_page_generations: "page_generation",
  autonomous_video_generations: "video_generation",
  autonomous_campaigns: "campaign_launch",
  autonomous_outbound_actions: "email_execution",
}

async function buildBudgetRemaining(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAiOsAutonomyPolicyBuildInput["budgetRemaining"]> {
  const remaining: NonNullable<GrowthAiOsAutonomyPolicyBuildInput["budgetRemaining"]> = {}

  for (const key of GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS) {
    const capability = GROWTH_AUTONOMY_BUDGET_KEY_TO_CAPABILITY[key]
    const snapshot = await getAutonomyBudgetSnapshot(admin, { organizationId, capability })
    remaining[key] = {
      cap: snapshot?.cap ?? 0,
      remaining: snapshot?.remaining ?? 0,
      exceeded: snapshot?.exceeded ?? false,
    }
  }

  return remaining
}

async function buildGrowthAiOsAutonomyPolicyPackage(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthAiOsAutonomyPolicyEvaluationContext> {
  const generatedAt = input.generatedAt ?? nowIso()
  const settings = await buildSettingsSnapshot(admin, input.organizationId)
  const budgetRemaining = await buildBudgetRemaining(admin, input.organizationId)
  const pilotState = getAutonomousResearchPilotOrgState(input.organizationId, generatedAt)
  const qualificationPilotState = getAutonomousQualificationPilotOrgState(input.organizationId, generatedAt)
  const planningPilotState = getAutonomousPlanningPilotOrgState(input.organizationId, generatedAt)
  const executionPilotState = getAutonomousExecutionPilotOrgState(input.organizationId, generatedAt)
  const recentRuns = pilotState.runs
  const recentQualificationRuns = qualificationPilotState.runs
  const recentPlanningRuns = planningPilotState.runs
  const recentExecutionRuns = executionPilotState.runs
  const hourAgo = Date.parse(generatedAt) - 60 * 60 * 1000
  const dayAgo = Date.parse(generatedAt) - 24 * 60 * 60 * 1000
  const researchHourlyConsumed = recentRuns.filter(
    (run) => Date.parse(run.completedAt) >= hourAgo,
  ).length
  const researchDailyConsumed = recentRuns.filter(
    (run) => Date.parse(run.completedAt) >= dayAgo,
  ).length
  const qualificationHourlyConsumed = recentQualificationRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= hourAgo,
  ).length
  const qualificationDailyConsumed = recentQualificationRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= dayAgo,
  ).length
  const planningHourlyConsumed = recentPlanningRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= hourAgo,
  ).length
  const planningDailyConsumed = recentPlanningRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= dayAgo,
  ).length
  const executionHourlyConsumed = recentExecutionRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= hourAgo,
  ).length
  const executionDailyConsumed = recentExecutionRuns.filter(
    (run) => run.outcome !== "skipped" && Date.parse(run.completedAt) >= dayAgo,
  ).length
  const [runtimeEnabled, runtimePilotEnabled] = await Promise.all([
    resolveExecutionRuntimeEnabled(admin, { organizationId: input.organizationId }),
    resolveExecutionRuntimePilotEnabled(admin, { organizationId: input.organizationId }),
  ])

  const policy = buildGrowthAiOsAutonomyPolicyReadModel({
    organizationId: input.organizationId,
    generatedAt,
    settings,
    runtimeEnabled,
    runtimePilotEnabled,
    researchPilotTelemetry: {
      budgetConsumptionHour: researchHourlyConsumed,
      budgetConsumptionDay: researchDailyConsumed,
    },
    qualificationPilotTelemetry: {
      budgetConsumptionHour: qualificationHourlyConsumed,
      budgetConsumptionDay: qualificationDailyConsumed,
    },
    planningPilotTelemetry: {
      budgetConsumptionHour: planningHourlyConsumed,
      budgetConsumptionDay: planningDailyConsumed,
    },
    executionPilotTelemetry: {
      budgetConsumptionHour: executionHourlyConsumed,
      budgetConsumptionDay: executionDailyConsumed,
    },
    budgetRemaining,
  })

  return { policy, settings }
}

export async function fetchGrowthAiOsAutonomyPolicy(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthAiOsAutonomyPolicyReadModel> {
  const evaluationContext = await buildGrowthAiOsAutonomyPolicyPackage(admin, input)
  return evaluationContext.policy
}

export async function fetchGrowthAiOsAutonomyPolicyEvaluationContext(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthAiOsAutonomyPolicyEvaluationContext> {
  return buildGrowthAiOsAutonomyPolicyPackage(admin, input)
}

export const GrowthAiOsAutonomyPolicyEngine = {
  fetchGrowthAiOsAutonomyPolicy,
  fetchGrowthAiOsAutonomyPolicyEvaluationContext,
} as const
