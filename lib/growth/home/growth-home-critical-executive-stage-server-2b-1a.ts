/**
 * AVA-GROWTH-HOTFIX-2B-1A — Critical Home executive stage (server-only).
 * Loads approval + training before secondary fan-out.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS,
  GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS,
  withGrowthHomeLoaderBudget,
  type GrowthHomeLoaderTiming,
} from "@/lib/growth/home/growth-home-workspace-loader-budget"
import {
  resolveGrowthHomeExecutiveApprovalsAvailability,
  type GrowthHomeExecutiveSourceAvailability,
} from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { loadGrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix"
import type { GrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-types"

export type GrowthHomeCriticalExecutiveStageResult = {
  timings: GrowthHomeLoaderTiming[]
  durationMs: number
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot | null
  approvalsAvailability: GrowthHomeExecutiveSourceAvailability
  trainingProjection: GrowthCanonicalOrganizationTrainingProjection | null
  trainingAvailability: GrowthHomeExecutiveSourceAvailability
}

export async function loadGrowthHomeCriticalExecutiveStage(input: {
  admin: SupabaseClient
  organizationId: string | null
  actorUserId: string
  generatedAt: string
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
    }
  }

  const [approvalStep, trainingStep] = await Promise.all([
    withGrowthHomeLoaderBudget({
      label: "critical_canonical_operator_approval",
      budgetMs: GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS,
      fn: () =>
        loadCanonicalOperatorApprovalSnapshotForHome(input.admin, {
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
  const approvalsAvailability = resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: Boolean(approvalLoaded),
    timedOut: approvalStep.timing.timedOut,
    pendingApprovalCount: approvalLoaded?.pendingApprovalCount ?? 0,
  })

  const trainingLoaded = trainingStep.value
  const trainingAvailability: GrowthHomeExecutiveSourceAvailability = trainingLoaded
    ? "confirmed"
    : trainingStep.timing.timedOut
      ? "unavailable"
      : "confirmed_empty"

  return {
    timings,
    durationMs: Date.now() - startedAt,
    approvalSnapshot:
      approvalsAvailability === "unavailable" ? null : approvalLoaded,
    approvalsAvailability,
    trainingProjection: trainingLoaded,
    trainingAvailability,
  }
}
