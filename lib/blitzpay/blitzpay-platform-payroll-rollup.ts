import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PLATFORM_PAYROLL_ORG_SAMPLE_CAP, summarizePayrollHealth } from "@/lib/blitzpay/blitzpay-payroll-runs"

export type BlitzpayPlatformPayrollRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  orgsWithDraftPayrollApprox: number
  orgsWithFailedPayrollApprox: number
  pendingCommissionExposureCentsApprox: number
  contractorSettlementPendingCentsApprox: number
  recurringSharePendingCentsApprox: number
  highCommissionExposureOrgsApprox: number
}

export async function fetchBlitzpayPlatformPayrollRollup(
  admin: SupabaseClient,
  opts?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformPayrollRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(opts?.reportingWindowDays ?? 30))))
  const { data: orgs, error } = await admin.from("organizations").select("id").order("created_at", { ascending: false }).limit(
    PLATFORM_PAYROLL_ORG_SAMPLE_CAP,
  )
  if (error) throw new Error(error.message)

  let orgsWithDraftPayrollApprox = 0
  let orgsWithFailedPayrollApprox = 0
  let pendingCommissionExposureCentsApprox = 0
  let contractorSettlementPendingCentsApprox = 0
  let recurringSharePendingCentsApprox = 0
  let highCommissionExposureOrgsApprox = 0

  for (const o of orgs ?? []) {
    const id = String((o as { id: string }).id)
    let h: Awaited<ReturnType<typeof summarizePayrollHealth>> | null = null
    try {
      h = await summarizePayrollHealth(admin, id)
    } catch {
      h = null
    }
    if (!h) continue
    orgsWithDraftPayrollApprox += h.draftPayrollRuns > 0 ? 1 : 0
    orgsWithFailedPayrollApprox += h.failedPayrollRuns > 0 ? 1 : 0
    pendingCommissionExposureCentsApprox += h.pendingCommissionCents
    contractorSettlementPendingCentsApprox += h.contractorSettlementPendingCents
    recurringSharePendingCentsApprox += h.revenueSharePendingCents
    if (h.pendingCommissionCents >= 250_000) highCommissionExposureOrgsApprox += 1
  }

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    orgsSampled: (orgs ?? []).length,
    orgsWithDraftPayrollApprox,
    orgsWithFailedPayrollApprox,
    pendingCommissionExposureCentsApprox,
    contractorSettlementPendingCentsApprox,
    recurringSharePendingCentsApprox,
    highCommissionExposureOrgsApprox,
  }
}
