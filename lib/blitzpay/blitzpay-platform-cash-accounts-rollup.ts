import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PLATFORM_CASH_ORG_SAMPLE_CAP, fetchBlitzpayOrgCashPlanningPayload } from "@/lib/blitzpay/blitzpay-cash-accounts-service"

export type BlitzpayPlatformCashAccountsRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  orgsWithReserveGapApprox: number
  orgsRunwayRiskApprox: number
  orgsRunwayWatchApprox: number
  sampleEstimatedOperatingCashTotalApprox: number
  payrollReserveLowCoverageOrgsApprox: number
  apReserveLowCoverageOrgsApprox: number
  outflowStressOrgsApprox: number
}

export async function fetchBlitzpayPlatformCashAccountsRollup(
  admin: SupabaseClient,
  opts?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformCashAccountsRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(opts?.reportingWindowDays ?? 30))))
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(PLATFORM_CASH_ORG_SAMPLE_CAP)
  if (error) throw new Error(error.message)

  let orgsWithReserveGapApprox = 0
  let orgsRunwayRiskApprox = 0
  let orgsRunwayWatchApprox = 0
  let sampleEstimatedOperatingCashTotalApprox = 0
  let payrollReserveLowCoverageOrgsApprox = 0
  let apReserveLowCoverageOrgsApprox = 0
  let outflowStressOrgsApprox = 0

  for (const o of orgs ?? []) {
    const id = String((o as { id: string }).id)
    try {
      const p = await fetchBlitzpayOrgCashPlanningPayload(admin, id, { reportingWindowDays })
      sampleEstimatedOperatingCashTotalApprox += p.summary.estimatedOperatingCashCents
      if (p.summary.cashReserveGapCents > 0) orgsWithReserveGapApprox += 1
      if (p.runway.status === "risk") orgsRunwayRiskApprox += 1
      else if (p.runway.status === "watch") orgsRunwayWatchApprox += 1
      if (p.health.payrollReserveCoverageBasisPoints < 6000) payrollReserveLowCoverageOrgsApprox += 1
      if (p.health.apReserveCoverageBasisPoints < 6000) apReserveLowCoverageOrgsApprox += 1
      if (p.runway.expectedOutflows30dCents > p.runway.expectedInflows30dCents) outflowStressOrgsApprox += 1
    } catch {
      /* ignore partial orgs */
    }
  }

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgsSampled: (orgs ?? []).length,
    orgsWithReserveGapApprox,
    orgsRunwayRiskApprox,
    orgsRunwayWatchApprox,
    sampleEstimatedOperatingCashTotalApprox,
    payrollReserveLowCoverageOrgsApprox,
    apReserveLowCoverageOrgsApprox,
    outflowStressOrgsApprox,
  }
}
