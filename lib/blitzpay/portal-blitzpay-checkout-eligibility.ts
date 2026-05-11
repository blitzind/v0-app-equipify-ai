import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import { fetchBlitzpayOrgSettingsRow } from "@/lib/blitzpay/payment-repository"

export type PortalBlitzpayHostedCheckoutUnavailableReason =
  | "feature_disabled"
  | "org_disabled"
  | "connect_not_ready"

export type PortalBlitzpayHostedCheckoutEligibility = {
  hostedCheckoutAvailable: boolean
  unavailableReason: PortalBlitzpayHostedCheckoutUnavailableReason | null
}

/**
 * Whether the workspace can offer BlitzPay hosted Checkout from the customer portal
 * (env gate, org toggle, Connect charges). Invoice-level rules are enforced at prepare-pay.
 */
export async function getPortalBlitzpayHostedCheckoutEligibility(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PortalBlitzpayHostedCheckoutEligibility> {
  if (!isBlitzPayInvoicePayEnabledEnv()) {
    return { hostedCheckoutAvailable: false, unavailableReason: "feature_disabled" }
  }

  const settings = await fetchBlitzpayOrgSettingsRow(admin, organizationId)
  if (!settings || !(settings as { blitzpay_invoice_pay_enabled?: boolean }).blitzpay_invoice_pay_enabled) {
    return { hostedCheckoutAvailable: false, unavailableReason: "org_disabled" }
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_charges_enabled")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return { hostedCheckoutAvailable: false, unavailableReason: "connect_not_ready" }
  }

  const acct = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  const chargesOk = Boolean((orgRow as { stripe_charges_enabled?: boolean }).stripe_charges_enabled)
  if (!acct || !chargesOk) {
    return { hostedCheckoutAvailable: false, unavailableReason: "connect_not_ready" }
  }

  return { hostedCheckoutAvailable: true, unavailableReason: null }
}
