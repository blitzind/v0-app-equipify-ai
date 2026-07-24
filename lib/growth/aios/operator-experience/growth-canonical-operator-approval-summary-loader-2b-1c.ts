/**
 * AVA-GROWTH-HOTFIX-2B-1C — Lightweight Home approval summary (server-only).
 * Outreach packages only — no HAC fan-in, portfolio authority, or lifecycle hydration.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { collectOutreachPackageApprovalItems } from "@/lib/growth/aios/approvals/growth-human-approval-center-engine"
import { indexOutreachPackagesById } from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import { buildGrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { buildCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"

export const AVA_GROWTH_HOTFIX_2B_1C_APPROVAL_SUMMARY_QA_MARKER =
  "ava-growth-hotfix-2b-1c-approval-summary-v1" as const

export async function loadCanonicalOperatorApprovalSummaryForHome(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
  },
): Promise<GrowthCanonicalOperatorApprovalSnapshot> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const outreachPilot = await buildGrowthAutonomousOutreachPreparationPilotReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  const outreachPreparationRuns = outreachPilot?.recentRuns ?? []
  const packages =
    outreachPreparationRuns
      .map((run) => run.approvalPackage)
      .filter((pkg): pkg is NonNullable<typeof pkg> => Boolean(pkg)) ?? []

  const hacItems = collectOutreachPackageApprovalItems({
    organizationId: input.organizationId,
    generatedAt,
    approvalWorkOrders: [],
    executionPlanReviewQueue: [],
    needsAttention: [],
    metaRecommendations: [],
    priorityBindings: [],
    revenueOperatorOrchestrations: [],
    geV15Inbox: [],
    automationApprovals: [],
    sequenceJobs: [],
    aiVoiceSessions: [],
    humanExecutionApprovals: [],
    outreachPreparationRuns,
    meetingPreparationRuns: [],
    boundedAutonomousOutbound: null,
    adaptiveCalibrationProposals: [],
  })

  return buildCanonicalOperatorApprovalSnapshot({
    hacItems,
    packagesById: indexOutreachPackagesById(packages),
  })
}
