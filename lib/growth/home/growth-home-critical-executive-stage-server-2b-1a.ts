/**
 * AVA-GROWTH-HOTFIX-2B-1A — Critical Home executive stage (server-only).
 * Loads approval + training before secondary fan-out.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCanonicalOperatorApprovalSummaryForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-approval-summary-loader-2b-1c"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS,
  GROWTH_HOME_CRITICAL_APPROVAL_SUMMARY_LOADER_BUDGET_MS,
  GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS,
  withGrowthHomeLoaderBudget,
  type GrowthHomeLoaderTiming,
} from "@/lib/growth/home/growth-home-workspace-loader-budget"
import {
  resolveGrowthHomeExecutiveApprovalsAvailability,
  resolveGrowthHomeExecutiveApprovalSource,
  type GrowthHomeExecutiveSourceAvailability,
} from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { loadGrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix"
import type { GrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-types"
import { logGrowthEngine } from "@/lib/growth/access"

export type GrowthHomeCriticalExecutiveStageResult = {
  timings: GrowthHomeLoaderTiming[]
  durationMs: number
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot | null
  approvalsAvailability: GrowthHomeExecutiveSourceAvailability
  trainingProjection: GrowthCanonicalOrganizationTrainingProjection | null
  trainingAvailability: GrowthHomeExecutiveSourceAvailability
  approvalSource: import("@/lib/growth/home/growth-home-critical-executive-load-2b-1a").GrowthHomeExecutiveApprovalSource
  approvalLoaderTimedOut: boolean
  approvalLoaderDurationMs: number
}

export async function loadGrowthHomeCriticalExecutiveStage(input: {
  admin: SupabaseClient
  organizationId: string | null
  actorUserId: string
  generatedAt: string
  /** Lightweight outreach-only approval summary for Home critical path. */
  lightweightApprovalLoader?: boolean
}): Promise<GrowthHomeCriticalExecutiveStageResult> {
  const startedAt = Date.now()
  const timings: GrowthHomeLoaderTiming[] = []

  if (!input.organizationId) {
    return {
      timings,
      durationMs: 0,
      approvalSnapshot: null,
      approvalsAvailability: "unavailable",
      trainingProjection: null,
      trainingAvailability: "unavailable",
      approvalSource: "unavailable",
      approvalLoaderTimedOut: false,
      approvalLoaderDurationMs: 0,
    }
  }

  const approvalBudgetMs = input.lightweightApprovalLoader
    ? GROWTH_HOME_CRITICAL_APPROVAL_SUMMARY_LOADER_BUDGET_MS
    : GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS
  const approvalLoaderLabel = input.lightweightApprovalLoader
    ? "critical_canonical_operator_approval_summary"
    : "critical_canonical_operator_approval"

  const [approvalStep, trainingStep] = await Promise.all([
    withGrowthHomeLoaderBudget({
      label: approvalLoaderLabel,
      budgetMs: approvalBudgetMs,
      fn: () =>
        input.lightweightApprovalLoader
          ? loadCanonicalOperatorApprovalSummaryForHome(input.admin, {
              organizationId: input.organizationId!,
              generatedAt: input.generatedAt,
            })
          : loadCanonicalOperatorApprovalSnapshotForHome(input.admin, {
              organizationId: input.organizationId!,
              generatedAt: input.generatedAt,
            }),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "critical_canonical_organization_training",
      budgetMs: GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS,
      fn: () =>
        loadGrowthCanonicalOrganizationTrainingProjection({
          admin: input.admin,
          organizationId: input.organizationId!,
          actorUserId: input.actorUserId,
          generatedAt: input.generatedAt,
        }),
      fallback: null,
    }),
  ])

  timings.push(approvalStep.timing, trainingStep.timing)

  const approvalLoaded = approvalStep.value
  const approvalLoadedSuccessfully = Boolean(approvalLoaded)
  const approvalsAvailability = resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: approvalLoadedSuccessfully,
    timedOut: approvalStep.timing.timedOut,
    pendingApprovalCount: approvalLoaded?.pendingApprovalCount ?? 0,
  })
  const approvalSource = resolveGrowthHomeExecutiveApprovalSource({
    loaded: approvalLoadedSuccessfully,
    pendingApprovalCount: approvalLoaded?.pendingApprovalCount ?? 0,
  })

  logGrowthEngine("growth_home_critical_executive_approval_stage", {
    organizationId: input.organizationId,
    approvalAvailability: approvalsAvailability,
    approvalSource,
    pendingApprovalCount: approvalLoaded?.pendingApprovalCount ?? null,
    approvalLoaderTimedOut: approvalStep.timing.timedOut,
    approvalLoaderDurationMs: approvalStep.timing.durationMs,
    idleEligible:
      approvalsAvailability === "confirmed_empty" &&
      (approvalLoaded?.pendingApprovalCount ?? 0) === 0,
  })

  const trainingLoaded = trainingStep.value
  const trainingAvailability: GrowthHomeExecutiveSourceAvailability = trainingLoaded
    ? "confirmed"
    : "unavailable"

  return {
    timings,
    durationMs: Date.now() - startedAt,
    approvalSnapshot:
      approvalsAvailability === "unavailable" ? null : approvalLoaded,
    approvalsAvailability,
    trainingProjection: trainingLoaded,
    trainingAvailability,
    approvalSource,
    approvalLoaderTimedOut: approvalStep.timing.timedOut,
    approvalLoaderDurationMs: approvalStep.timing.durationMs,
  }
}
