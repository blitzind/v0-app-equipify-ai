/**
 * GE-AIOS-OPERATOR-EXPERIENCE-1A — Server-side canonical approval snapshot loader (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchHomeApprovalCommandCenterSlice } from "@/lib/growth/home/growth-home-approval-command-center-slice"
import { fetchGrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-service"
import { indexOutreachPackagesById } from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import { buildCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import { GROWTH_HOME_HAC_TOP_LIMIT, GROWTH_HOME_HAC_TOTAL_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export async function loadCanonicalOperatorApprovalSnapshotForHome(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
  },
): Promise<GrowthCanonicalOperatorApprovalSnapshot> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const commandCenterSlice = await fetchHomeApprovalCommandCenterSlice(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const hac = await fetchGrowthHumanApprovalCenterReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
    commandCenter: commandCenterSlice,
    topLimit: GROWTH_HOME_HAC_TOP_LIMIT,
    totalLimit: GROWTH_HOME_HAC_TOTAL_LIMIT,
  })

  const packages =
    commandCenterSlice.autonomousOutreachPreparationPilot.recentRuns
      ?.map((run) => run.approvalPackage)
      .filter((pkg): pkg is NonNullable<typeof pkg> => Boolean(pkg)) ?? []

  return buildCanonicalOperatorApprovalSnapshot({
    hacItems: hac.items,
    packagesById: indexOutreachPackagesById(packages),
  })
}

/** Full Command Center path — retained for non-Home surfaces. */
export async function loadCanonicalOperatorApprovalSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
  },
): Promise<GrowthCanonicalOperatorApprovalSnapshot> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const { fetchAiOsCommandCenterReadModel } = await import(
    "@/lib/growth/aios/ai-os-command-center-service"
  )
  const commandCenter = await fetchAiOsCommandCenterReadModel(admin, {
    organizationId: input.organizationId,
  })
  const hac = await fetchGrowthHumanApprovalCenterReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
    commandCenter,
    topLimit: GROWTH_HOME_HAC_TOP_LIMIT,
    totalLimit: GROWTH_HOME_HAC_TOTAL_LIMIT,
  })

  const packages =
    commandCenter.autonomousOutreachPreparationPilot.recentRuns
      ?.map((run) => run.approvalPackage)
      .filter((pkg): pkg is NonNullable<typeof pkg> => Boolean(pkg)) ?? []

  return buildCanonicalOperatorApprovalSnapshot({
    hacItems: hac.items,
    packagesById: indexOutreachPackagesById(packages),
  })
}
