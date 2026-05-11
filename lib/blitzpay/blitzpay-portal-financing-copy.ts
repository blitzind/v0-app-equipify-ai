/**
 * Customer-safe financing / installment copy for portal (Phase 2O).
 */

import {
  buildQuoteRevenueAccelerationInsights,
  type RevenueAccelerationInsight,
} from "@/lib/blitzpay/blitzpay-revenue-acceleration-insights"

const PORTAL_FINANCING_CODES = new Set(["financing_ready", "staged_payments", "mark_financing_ready"])

export function pickPortalQuoteFinancingTips(insights: RevenueAccelerationInsight[]): string[] {
  const out: string[] = []
  for (const i of insights) {
    if (!PORTAL_FINANCING_CODES.has(i.code)) continue
    out.push(i.detail)
    if (out.length >= 2) break
  }
  return out
}

export function buildPortalQuoteFinancingPayload(input: {
  orgFinancingEnabled: boolean
  orgInstallmentPlansEnabled: boolean
  monthlyEstimateDisclosure: string | null
  quoteAmountCents: number
  depositCollectedCents: number
  depositTargetCents: number | null
  financingReady: boolean
}): {
  orgFinancingEnabled: boolean
  orgInstallmentPlansEnabled: boolean
  monthlyEstimateCopy: string | null
  tips: string[]
} {
  const insights = buildQuoteRevenueAccelerationInsights({
    orgFinancingEnabled: input.orgFinancingEnabled,
    orgInstallmentPlansEnabled: input.orgInstallmentPlansEnabled,
    quoteAmountCents: input.quoteAmountCents,
    depositCollectedCents: input.depositCollectedCents,
    depositTargetCents: input.depositTargetCents,
    financingReady: input.financingReady,
  })
  const disc = input.monthlyEstimateDisclosure?.trim() || null
  const amtLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    input.quoteAmountCents / 100,
  )
  const monthly =
    input.orgFinancingEnabled && disc && input.quoteAmountCents >= 5000 ?
      disc.replace(/\{\{\s*amount\s*\}\}/gi, amtLabel)
    : null

  return {
    orgFinancingEnabled: input.orgFinancingEnabled,
    orgInstallmentPlansEnabled: input.orgInstallmentPlansEnabled,
    monthlyEstimateCopy: monthly,
    tips: pickPortalQuoteFinancingTips(insights),
  }
}
