import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { fetchBlitzpayStoredPaymentProfilesSummary } from "@/lib/blitzpay/blitzpay-payment-profiles"

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
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .maybeSingle()

  let reporting: Awaited<ReturnType<typeof fetchBlitzpayOrgReportingSnapshot>> | null = null
  let profileSummary: Awaited<ReturnType<typeof fetchBlitzpayStoredPaymentProfilesSummary>> | null = null
  try {
    const admin = createServiceRoleSupabaseClient()
    const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    const [reportingRes, profileRes] = await Promise.all([
      fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso }),
      fetchBlitzpayStoredPaymentProfilesSummary(admin, organizationId),
    ])
    reporting = reportingRes
    profileSummary = profileRes
  } catch {
    reporting = null
    profileSummary = null
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
            recentRefundedTotalCents: reporting.refundedVolumeCents,
            reportingSource: reporting.reportingSource,
            paidOutToBankCents: reporting.paidOutToBankCents,
            connectedAccountNetActivityCents: reporting.connectedAccountNetActivityCents,
            paymentMethodMix: reporting.paymentMethodMix,
            achSettlement: reporting.achSettlement,
            payoutStatus: (org as { stripe_payouts_enabled?: boolean | null } | null)?.stripe_payouts_enabled
              ? "payouts_enabled"
              : "payouts_not_ready",
          }
        : null,
      storedPaymentProfiles: profileSummary,
      stripeMode,
    },
  })
}
