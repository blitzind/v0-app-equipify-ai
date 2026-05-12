/**
 * Deterministic forecast snapshot rows (planning only; integer cents).
 */

import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type BlitzpayAiForecastDraft = {
  snapshot_type: "treasury" | "collections" | "payroll" | "procurement" | "revenue" | "memberships" | "financing"
  forecast_window_days: number
  forecast_confidence_score: number | null
  projected_inflow_cents: number | null
  projected_outflow_cents: number | null
  projected_net_cents: number | null
  projected_risk_score: number | null
  deterministic_inputs: Record<string, number | string | boolean>
}

const MAX_WINDOW = 90

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildBlitzpayAiForecastSnapshots(
  reporting: BlitzpayOrgReportingSnapshot,
  windowDays: number,
): BlitzpayAiForecastDraft[] {
  const w = Math.max(7, Math.min(MAX_WINDOW, Math.round(windowDays)))
  const in30 = Math.max(0, reporting.expectedInflows30dCents)
  const out30 = Math.max(0, reporting.expectedOutflows30dCents)
  const scale = w / 30
  const inW = Math.round(in30 * scale)
  const outW = Math.round(out30 * scale)

  const drafts: BlitzpayAiForecastDraft[] = [
    {
      snapshot_type: "treasury",
      forecast_window_days: w,
      forecast_confidence_score: reporting.cashRunwayStatus === "healthy" ? 72 : reporting.cashRunwayStatus === "watch" ? 58 : 44,
      projected_inflow_cents: inW,
      projected_outflow_cents: outW + Math.max(0, reporting.treasuryPendingPayoutTotalsCents),
      projected_net_cents: inW - (outW + Math.max(0, reporting.treasuryPendingPayoutTotalsCents)),
      projected_risk_score: Math.min(100, reporting.treasuryFailedPayoutCount30d * 12 + (reporting.cashRunwayStatus === "risk" ? 35 : 0)),
      deterministic_inputs: {
        cash_runway_status: reporting.cashRunwayStatus,
        treasury_failed_payout_count_30d: reporting.treasuryFailedPayoutCount30d,
      },
    },
    {
      snapshot_type: "collections",
      forecast_window_days: w,
      forecast_confidence_score: clampScore(80 - Math.floor(reporting.failedPaymentRate)),
      projected_inflow_cents: Math.max(0, reporting.blitzpayRecurringPlannedInflow30dCents) + Math.floor(in30 * 0.35 * scale),
      projected_outflow_cents: 0,
      projected_net_cents: null,
      projected_risk_score: Math.min(100, Math.floor(reporting.delinquencyRate * 4 + reporting.failedPaymentRate * 2)),
      deterministic_inputs: {
        collection_success_rate: reporting.collectionSuccessRate,
        delinquency_rate: reporting.delinquencyRate,
      },
    },
    {
      snapshot_type: "payroll",
      forecast_window_days: w,
      forecast_confidence_score: 62,
      projected_inflow_cents: null,
      projected_outflow_cents: Math.max(0, reporting.payrollLiabilityCents + reporting.estimatedPayrollBurdenCents),
      projected_net_cents: -Math.max(0, reporting.payrollLiabilityCents + reporting.estimatedPayrollBurdenCents),
      projected_risk_score: Math.min(
        100,
        Math.floor(
          (Math.max(0, reporting.payrollLiabilityCents) * 100) /
            Math.max(1, reporting.estimatedOperatingCashCents + reporting.expectedInflows7dCents),
        ),
      ),
      deterministic_inputs: {
        payroll_liability_cents: reporting.payrollLiabilityCents,
        estimated_payroll_burden_cents: reporting.estimatedPayrollBurdenCents,
      },
    },
    {
      snapshot_type: "procurement",
      forecast_window_days: w,
      forecast_confidence_score: 55,
      projected_inflow_cents: null,
      projected_outflow_cents: Math.max(0, Math.round(reporting.reorderExposureCents * scale)),
      projected_net_cents: -Math.max(0, Math.round(reporting.reorderExposureCents * scale)),
      projected_risk_score: clampScore(reporting.procurementTreasuryImpactScore),
      deterministic_inputs: {
        reorder_exposure_cents: reporting.reorderExposureCents,
        procurement_treasury_impact_score: reporting.procurementTreasuryImpactScore,
      },
    },
    {
      snapshot_type: "revenue",
      forecast_window_days: w,
      forecast_confidence_score: 68,
      projected_inflow_cents: Math.max(0, Math.round(reporting.invoiceStylePaymentCapturedCents * (w / 30))),
      projected_outflow_cents: Math.max(0, reporting.refundedVolumeCents),
      projected_net_cents:
        Math.max(0, Math.round(reporting.invoiceStylePaymentCapturedCents * (w / 30))) -
        Math.max(0, reporting.refundedVolumeCents),
      projected_risk_score: clampScore(
        Math.floor((reporting.openDisputesAmountCents * 100) / Math.max(1, reporting.netCollectedCents + 1)),
      ),
      deterministic_inputs: {
        invoice_style_payment_captured_cents: reporting.invoiceStylePaymentCapturedCents,
        open_disputes_amount_cents: reporting.openDisputesAmountCents,
      },
    },
    {
      snapshot_type: "memberships",
      forecast_window_days: w,
      forecast_confidence_score: clampScore(85 - reporting.blitzpayChurnRiskScore0to100),
      projected_inflow_cents: Math.max(0, reporting.recurringRevenueCents),
      projected_outflow_cents: Math.max(0, reporting.delinquentMembershipRevenueCents),
      projected_net_cents: Math.max(0, reporting.recurringRevenueCents) - Math.max(0, reporting.delinquentMembershipRevenueCents),
      projected_risk_score: clampScore(reporting.blitzpayChurnRiskScore0to100),
      deterministic_inputs: {
        churn_risk_score: reporting.blitzpayChurnRiskScore0to100,
        renewal_pipeline_cents: reporting.renewalPipelineCents,
      },
    },
    {
      snapshot_type: "financing",
      forecast_window_days: w,
      forecast_confidence_score: 50,
      projected_inflow_cents: Math.max(0, reporting.financingRevenueOpportunity),
      projected_outflow_cents: Math.max(0, reporting.contractorAdvanceExposure),
      projected_net_cents: null,
      projected_risk_score: clampScore(reporting.financingRiskScore),
      deterministic_inputs: {
        financing_risk_score: reporting.financingRiskScore,
        financing_sessions_created_window: reporting.blitzpayFinancingSessionsCreatedWindowCount,
      },
    },
  ]

  return drafts
}
