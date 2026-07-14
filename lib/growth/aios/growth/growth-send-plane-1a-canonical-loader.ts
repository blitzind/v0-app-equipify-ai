/** GE-AIOS-SEND-PLANE-1A — Resolve canonical outreach package for transport (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { hasCanonicalSalesStrategyBriefPackage } from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"

function isEligibleCompletedRun(
  run: GrowthAutonomousOutreachPreparationRunRecord,
): run is GrowthAutonomousOutreachPreparationRunRecord & {
  approvalPackage: GrowthAutonomousOutreachApprovalPackage
} {
  return (
    run.outcome === "completed" &&
    run.leadId.length > 0 &&
    hasCanonicalSalesStrategyBriefPackage(run.approvalPackage)
  )
}

function compareCanonicalPreparationRuns(
  left: GrowthAutonomousOutreachPreparationRunRecord,
  right: GrowthAutonomousOutreachPreparationRunRecord,
): number {
  const leftApproved = left.approvalPackage?.packageApprovalDecision === "approved" ? 1 : 0
  const rightApproved = right.approvalPackage?.packageApprovalDecision === "approved" ? 1 : 0
  if (leftApproved !== rightApproved) return rightApproved - leftApproved

  const completedDelta = Date.parse(right.completedAt) - Date.parse(left.completedAt)
  if (completedDelta !== 0) return completedDelta

  const preparedDelta =
    Date.parse(right.approvalPackage?.preparedAt ?? right.completedAt) -
    Date.parse(left.approvalPackage?.preparedAt ?? left.completedAt)
  if (preparedDelta !== 0) return preparedDelta

  return (right.packageId ?? right.runId).localeCompare(left.packageId ?? left.runId)
}

export async function resolveCanonicalOutreachPackageForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
  },
): Promise<GrowthAutonomousOutreachApprovalPackage | null> {
  const runs = await listOutreachPreparationRunsForLead(
    admin,
    input.organizationId,
    input.leadId,
  )

  const eligible = runs.filter(isEligibleCompletedRun).sort(compareCanonicalPreparationRuns)
  return eligible[0]?.approvalPackage ?? null
}
