import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { fetchBlitzpayStoredPaymentProfilesSummary } from "@/lib/blitzpay/blitzpay-payment-profiles"
import { computeBlitzpayCollectionsReporting } from "@/lib/blitzpay/blitzpay-collections"
import { runBlitzpaySchemaHealthCheckCached } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Read-only BlitzPay Connect snapshot for any active org member.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse("GET /api/organizations/[organizationId]/blitzpay/status")
  if (schemaResp) return schemaResp

  const { supabase } = gate

  const { data: org, error } = await supabase
    .from("organizations")
    .select(
      [
        "stripe_connect_account_id",
        "stripe_connect_status",
        "stripe_connect_onboarding_complete",
        "stripe_charges_enabled",
        "stripe_payouts_enabled",
        "stripe_details_submitted",
        "stripe_requirements_currently_due",
        "stripe_requirements_eventually_due",
        "stripe_requirements_past_due",
        "last_stripe_connect_sync_at",
        "blitzpay_last_onboarding_attempt_at",
        "blitzpay_last_onboarding_failure_at",
        "blitzpay_last_onboarding_error_category",
        "blitzpay_last_stripe_request_id",
      ].join(", "),
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  const { data: settings } = await supabase
    .from("blitzpay_org_settings")
    .select(
      [
        "blitzpay_invoice_pay_enabled",
        "blitzpay_pass_processing_fees_to_customer",
        "blitzpay_fee_mode",
        "blitzpay_fee_percentage_snapshot",
        "blitzpay_fee_cap_cents",
        "blitzpay_fee_disclosure_copy",
        "blitzpay_payment_method_card_enabled",
        "blitzpay_payment_method_ach_enabled",
        "blitzpay_ach_convenience_fee_enabled",
        "blitzpay_ach_processing_timeline_copy",
        "blitzpay_allow_save_payment_methods",
        "blitzpay_reminders_enabled",
        "blitzpay_receipt_emails_enabled",
        "blitzpay_financing_enabled",
        "blitzpay_installment_plans_enabled",
        "blitzpay_financing_monthly_estimate_disclosure",
        "blitzpay_reserve_target_cents",
        "blitzpay_instant_payout_interest",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .maybeSingle()

  let reporting: Awaited<ReturnType<typeof fetchBlitzpayOrgReportingSnapshot>> | null = null
  let profileSummary: Awaited<ReturnType<typeof fetchBlitzpayStoredPaymentProfilesSummary>> | null = null
  let collectionsReporting: Awaited<ReturnType<typeof computeBlitzpayCollectionsReporting>> | null = null
  let operationalAlerts: Array<{ severity: "critical" | "warning" | "info"; code: string; message: string }> = []
  try {
    const admin = createServiceRoleSupabaseClient()
    const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    const since24h = new Date(Date.now() - 86400_000).toISOString()
    const [reportingRes, profileRes, collectionsRes, schemaHealth, { count: webhookDead24h }] = await Promise.all([
      fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso }),
      fetchBlitzpayStoredPaymentProfilesSummary(admin, organizationId),
      computeBlitzpayCollectionsReporting(admin, organizationId),
      runBlitzpaySchemaHealthCheckCached(admin),
      admin
        .from("blitzpay_webhook_inbox")
        .select("stripe_event_id", { count: "exact", head: true })
        .eq("processing_status", "dead")
        .gte("created_at", since24h),
    ])
    reporting = reportingRes
    profileSummary = profileRes
    collectionsReporting = collectionsRes
    if (!schemaHealth.ok) {
      operationalAlerts.push({
        severity: "critical",
        code: "schema_incomplete",
        message:
          schemaHealth.kind === "schema_incomplete" ?
            `BlitzPay schema incomplete (${schemaHealth.missing}). Apply migrations.`
          : "BlitzPay schema health check failed.",
      })
    }
    if ((webhookDead24h ?? 0) > 0) {
      operationalAlerts.push({
        severity: "warning",
        code: "webhook_dead_recent",
        message: `${webhookDead24h ?? 0} dead webhook inbox event(s) in the last 24h (platform-wide signal).`,
      })
    }
    const chargesOk = Boolean((org as { stripe_charges_enabled?: boolean | null } | null)?.stripe_charges_enabled)
    const acct = String((org as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? "").trim()
    if (acct && !chargesOk) {
      operationalAlerts.push({
        severity: "warning",
        code: "connect_charges_not_ready",
        message: "Stripe Connect account exists but charges are not enabled yet.",
      })
    }
  } catch {
    reporting = null
    profileSummary = null
    collectionsReporting = null
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const stripeMode = stripeSecret.startsWith("sk_live_") ? "live" : stripeSecret.startsWith("sk_test_") ? "test" : "unknown"

  return NextResponse.json({
    organizationId,
    blitzpay: {
      ...(org ?? {}),
      settings: settings ?? null,
      payoutVisibility: reporting
        ? {
            estimatedNetPayoutCents: reporting.estimatedNetMerchantPayoutCents,
            estimatedStripeFeesCents: reporting.estimatedStripeFeesCents,
            recentOnlinePaymentTotalCents: reporting.grossProcessedVolumeCents,
            estimateDepositCapturedCents: reporting.estimateDepositCapturedCents,
            invoiceStylePaymentCapturedCents: reporting.invoiceStylePaymentCapturedCents,
            quotesWithBlitzpayDepositCollected: reporting.quotesWithBlitzpayDepositCollected,
            financingReadyQuotesCount: reporting.financingReadyQuotesCount,
            recentRefundedTotalCents: reporting.refundedVolumeCents,
            reportingSource: reporting.reportingSource,
            paidOutToBankCents: reporting.paidOutToBankCents,
            connectedAccountNetActivityCents: reporting.connectedAccountNetActivityCents,
            paymentMethodMix: reporting.paymentMethodMix,
            achSettlement: reporting.achSettlement,
            customerWalletSpendableCreditTotalCents: reporting.customerWalletSpendableCreditTotalCents,
            customerWalletRefundableCreditTotalCents: reporting.customerWalletRefundableCreditTotalCents,
            customerUnappliedEstimateDepositTotalCents: reporting.customerUnappliedEstimateDepositTotalCents,
            customerWalletAppliedToInvoicesWindowCents: reporting.customerWalletAppliedToInvoicesWindowCents,
            customerWalletCreditInflowWindowCents: reporting.customerWalletCreditInflowWindowCents,
            blitzpayActivePaymentPlansCount: reporting.blitzpayActivePaymentPlansCount,
            blitzpayPaymentPlanInstallmentsPaidCentsTotal: reporting.blitzpayPaymentPlanInstallmentsPaidCentsTotal,
            blitzpayFinancingSessionsTotal: reporting.blitzpayFinancingSessionsTotal,
            blitzpayFinancingSessionsFundedOrReleasedCount: reporting.blitzpayFinancingSessionsFundedOrReleasedCount,
            blitzpayFinancingSessionsCreatedWindowCount: reporting.blitzpayFinancingSessionsCreatedWindowCount,
            estimateDepositBeforeWorkQuoteCount: reporting.estimateDepositBeforeWorkQuoteCount,
            estimateOpenQuotesWithTotalCount: reporting.estimateOpenQuotesWithTotalCount,
            blitzpayWorkOrderCollectPaymentLinksWindowCount: reporting.blitzpayWorkOrderCollectPaymentLinksWindowCount,
            workOrdersFieldInvoiceLaterWindowCount: reporting.workOrdersFieldInvoiceLaterWindowCount,
            treasuryAveragePayoutDelayDays: reporting.treasuryAveragePayoutDelayDays,
            treasuryPendingPayoutTotalsCents: reporting.treasuryPendingPayoutTotalsCents,
            treasuryFailedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
            treasuryInstantTransferEligible: reporting.treasuryInstantTransferEligible,
            treasuryReserveExposureCents: reporting.treasuryReserveExposureCents,
            treasuryPayoutVelocityPaidCents7d: reporting.treasuryPayoutVelocityPaidCents7d,
            treasuryPayoutVelocityPaidCents30d: reporting.treasuryPayoutVelocityPaidCents30d,
            treasuryEstimateUpcomingTransferCents: reporting.treasuryEstimateUpcomingTransferCents,
            treasuryPayoutSpeedLane: reporting.treasuryPayoutSpeedLane,
            payoutStatus: (org as { stripe_payouts_enabled?: boolean | null } | null)?.stripe_payouts_enabled
              ? "payouts_enabled"
              : "payouts_not_ready",
          }
        : null,
      storedPaymentProfiles: profileSummary,
      collectionsReporting,
      stripeMode,
      operationalAlerts,
    },
  })
}
