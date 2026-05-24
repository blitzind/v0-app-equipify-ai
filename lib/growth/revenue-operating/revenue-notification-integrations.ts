import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"

export async function emitGrowthForecastGapNotification(
  admin: SupabaseClient,
  input: { gapToGoal: number; activeGoal: number; periodLabel: string },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "forecast_gap",
    title: "Forecast gap detected",
    body: `Pipeline is $${input.gapToGoal.toLocaleString()} below ${input.periodLabel} goal of $${input.activeGoal.toLocaleString()}.`,
    sourceSystem: "opportunity",
    sourceId: "forecast_gap",
    actionUrl: `/admin/growth/revenue-operating`,
    metadata: { gapToGoal: input.gapToGoal, activeGoal: input.activeGoal },
  })
}

export async function emitGrowthPipelineCoverageLowNotification(
  admin: SupabaseClient,
  input: { coverageRatio: number; targetCoverage: number },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "pipeline_coverage_low",
    title: "Pipeline coverage low",
    body: `Coverage ratio ${input.coverageRatio}x is below target ${input.targetCoverage}x.`,
    sourceSystem: "opportunity",
    sourceId: "pipeline_coverage_low",
    actionUrl: `/admin/growth/revenue-operating`,
    metadata: { coverageRatio: input.coverageRatio, targetCoverage: input.targetCoverage },
  })
}

export async function emitGrowthCommitRiskNotification(
  admin: SupabaseClient,
  input: { commitForecast: number; activeGoal: number },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "commit_risk",
    title: "Commit forecast at risk",
    body: `Commit forecast $${input.commitForecast.toLocaleString()} is below half of goal $${input.activeGoal.toLocaleString()}.`,
    sourceSystem: "opportunity",
    sourceId: "commit_risk",
    actionUrl: `/admin/growth/revenue-operating`,
    metadata: { commitForecast: input.commitForecast, activeGoal: input.activeGoal },
  })
}

export async function emitGrowthStaleHighValueDealNotification(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    leadId: string
    companyName: string
    amount: number
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
    notificationType: "stale_high_value_deal",
    title: "Stale high-value deal",
    body: `${input.companyName} ($${input.amount.toLocaleString()}) needs executive review.`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId,
    actionUrl: `/admin/growth/opportunities/pipeline?opportunityId=${input.opportunityId}`,
    metadata: { amount: input.amount },
  })
}

export async function emitGrowthCloseDateSlippedNotification(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    leadId: string
    companyName: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
    notificationType: "close_date_slipped",
    title: "Close date slipped",
    body: `${input.companyName} expected close date has passed.`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId,
    actionUrl: `/admin/growth/opportunities/pipeline?opportunityId=${input.opportunityId}`,
    metadata: { companyName: input.companyName },
  })
}

export async function emitGrowthOwnerPipelineOverloadedNotification(
  admin: SupabaseClient,
  input: { ownerUserId: string | null; weightedPipeline: number },
): Promise<void> {
  if (!input.ownerUserId) return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    notificationType: "owner_pipeline_overloaded",
    title: "Owner pipeline overloaded",
    body: `Rep has $${input.weightedPipeline.toLocaleString()} weighted pipeline — review load balance.`,
    sourceSystem: "rep_ops",
    sourceId: input.ownerUserId,
    actionUrl: `/admin/growth/revenue-operating`,
    metadata: { weightedPipeline: input.weightedPipeline },
  })
}

export async function emitGrowthOwnerPipelineUnderloadedNotification(
  admin: SupabaseClient,
  input: { ownerUserId: string | null; weightedPipeline: number },
): Promise<void> {
  if (!input.ownerUserId) return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    notificationType: "owner_pipeline_underloaded",
    title: "Owner pipeline underloaded",
    body: `Rep has only $${input.weightedPipeline.toLocaleString()} weighted pipeline — capacity available.`,
    sourceSystem: "rep_ops",
    sourceId: input.ownerUserId,
    actionUrl: `/admin/growth/revenue-operating`,
    metadata: { weightedPipeline: input.weightedPipeline },
  })
}
