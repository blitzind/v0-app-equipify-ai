/** GE-AIOS-SEND-PLANE-1A — Resolve canonical outreach package for transport (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { listAutonomousOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { hasCanonicalSalesStrategyBriefPackage } from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"

export async function resolveCanonicalOutreachPackageForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
  },
): Promise<GrowthAutonomousOutreachApprovalPackage | null> {
  const runs = await listAutonomousOutreachPreparationRunsForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    limit: 12,
  })

  const completed = runs.filter(
    (run) => run.outcome === "completed" && hasCanonicalSalesStrategyBriefPackage(run.approvalPackage),
  )

  const approved = completed.find(
    (run) => run.approvalPackage?.packageApprovalDecision === "approved",
  )
  if (approved?.approvalPackage) return approved.approvalPackage

  return completed[0]?.approvalPackage ?? null
}
