import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
import { createBlitzpayInvoiceCheckoutSession } from "@/lib/blitzpay/connect-stripe"
import { computeBlitzpayApplicationFeeBreakdown, type BlitzpayFeeInputs } from "@/lib/blitzpay/fees"
import { buildBlitzPayPaymentIntentIdempotencyKey } from "@/lib/blitzpay/idempotency-keys"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import {
  assertInvoicePayableForBlitzpay,
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumRecordedPaymentsCents,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import {
  createBlitzpayFeeSnapshot,
  createBlitzpayInvoicePaymentAttempt,
  createBlitzpayPaymentIntentRecord,
  fetchBlitzpayOrgSettingsRow,
  nextBlitzpayInvoicePaymentAttemptNo,
} from "@/lib/blitzpay/payment-repository"
import { blitzpayInvoicePaymentMetadata } from "@/lib/blitzpay/stripe-metadata"
import { tryConsumeBlitzpayPreparePaySlots } from "@/lib/blitzpay/blitzpay-rate-limit"
import { DEFAULT_BLITZPAY_FEE_POLICY_VERSION } from "@/lib/blitzpay/payment-domain"
import type { BlitzpayInvoicePayChannel } from "@/lib/blitzpay/payment-domain"

export type PrepareBlitzpayInvoicePayResult = {
  url: string
  checkoutSessionId: string
  stripePaymentIntentId: string
  blitzpayPaymentIntentRowId: string
}

type PrepareBlitzpayInvoiceHostedCheckoutStaffInput = {
  admin: SupabaseClient
  organizationId: string
  invoiceId: string
  initiatedBy: "staff_dashboard"
  userId: string
}

type PrepareBlitzpayInvoiceHostedCheckoutPortalInput = {
  admin: SupabaseClient
  organizationId: string
  invoiceId: string
  initiatedBy: "customer_portal"
  portalUserId: string
  portalCustomerId: string
  returnUrls: { successUrl: string; cancelUrl: string }
}

export type PrepareBlitzpayInvoiceHostedCheckoutInput =
  | PrepareBlitzpayInvoiceHostedCheckoutStaffInput
  | PrepareBlitzpayInvoiceHostedCheckoutPortalInput

function errCode(e: unknown): string {
  return e instanceof Error ? e.message : "prepare_failed"
}

function buildPreparePayAttemptToken(input: PrepareBlitzpayInvoiceHostedCheckoutInput): string {
  const nonce = randomUUID().replace(/-/g, "")
  if (input.initiatedBy === "staff_dashboard") {
    return randomUUID()
  }
  const h = createHash("sha256")
    .update(`blitzpay_portal_prepare:${input.portalUserId}:${nonce}`)
    .digest("hex")
    .slice(0, 24)
  return `pt_${h}_${nonce}`
}

function rateLimitPrincipalId(input: PrepareBlitzpayInvoiceHostedCheckoutInput): string {
  if (input.initiatedBy === "staff_dashboard") {
    return input.userId
  }
  return `portal:${input.portalUserId}`
}

function paymentSourceForMetadata(
  input: PrepareBlitzpayInvoiceHostedCheckoutInput,
): "staff_dashboard" | "customer_portal" {
  return input.initiatedBy === "staff_dashboard" ? "staff_dashboard" : "customer_portal"
}

function attemptChannel(input: PrepareBlitzpayInvoiceHostedCheckoutInput): BlitzpayInvoicePayChannel {
  return input.initiatedBy === "staff_dashboard" ? "checkout" : "portal_link"
}

function createdByUserId(input: PrepareBlitzpayInvoiceHostedCheckoutInput): string | null {
  return input.initiatedBy === "staff_dashboard" ? input.userId : null
}

function portalAccessContext(
  input: PrepareBlitzpayInvoiceHostedCheckoutInput,
): Record<string, unknown> | null {
  if (input.initiatedBy !== "customer_portal") return null
  return {
    payment_channel: "customer_portal",
    portal_user_id: input.portalUserId,
  }
}

export async function prepareBlitzpayInvoiceHostedCheckout(
  input: PrepareBlitzpayInvoiceHostedCheckoutInput,
): Promise<{ ok: true; data: PrepareBlitzpayInvoicePayResult } | { ok: false; status: number; code: string; message: string }> {
  const { admin, organizationId, invoiceId } = input

  if (!isBlitzPayInvoicePayEnabledEnv()) {
    return { ok: false, status: 403, code: "feature_disabled", message: "BlitzPay invoice pay is not enabled for this deployment." }
  }

  const rate = await tryConsumeBlitzpayPreparePaySlots(admin, {
    organizationId,
    invoiceId,
    userId: rateLimitPrincipalId(input),
  })
  if (!rate.ok) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: "Too many payment attempts. Please wait a minute and try again.",
    }
  }

  const settings = await fetchBlitzpayOrgSettingsRow(admin, organizationId)
  if (!settings || !(settings as { blitzpay_invoice_pay_enabled?: boolean }).blitzpay_invoice_pay_enabled) {
    return {
      ok: false,
      status: 403,
      code: "org_pay_disabled",
      message: "BlitzPay online pay is not enabled for this workspace.",
    }
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_charges_enabled, stripe_connect_status")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return { ok: false, status: 500, code: "org_load_failed", message: "Could not load workspace." }
  }

  const acct = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  const chargesOk = Boolean((orgRow as { stripe_charges_enabled?: boolean }).stripe_charges_enabled)
  if (!acct || !chargesOk) {
    return {
      ok: false,
      status: 409,
      code: "connect_not_ready",
      message: "Stripe Connect is not ready to accept charges. Finish BlitzPay onboarding in Settings → Payments.",
    }
  }

  const inv = await loadInvoiceForBlitzpayPay(admin, organizationId, invoiceId)
  if (!inv) {
    return { ok: false, status: 404, code: "invoice_not_found", message: "Invoice not found." }
  }

  if (input.initiatedBy === "customer_portal" && inv.customer_id !== input.portalCustomerId) {
    return { ok: false, status: 404, code: "invoice_not_found", message: "Invoice not found." }
  }

  const paidSum = await sumRecordedPaymentsCents(admin, organizationId, invoiceId)
  try {
    assertInvoicePayableForBlitzpay(inv, paidSum)
  } catch (e) {
    const code = errCode(e)
    const map: Record<string, string> = {
      invoice_archived: "This invoice is archived.",
      invoice_not_payable_status: "This invoice cannot be paid online.",
      invoice_no_balance_due: "There is no balance due for this invoice.",
    }
    return {
      ok: false,
      status: 409,
      code,
      message: map[code] ?? "This invoice cannot be paid online.",
    }
  }

  const balanceDue = balanceDueCentsForBlitzpay(inv, paidSum)
  if (balanceDue < 50) {
    return {
      ok: false,
      status: 409,
      code: "amount_below_minimum",
      message: "Balance due is below the card minimum (USD 0.50). Record a manual payment instead.",
    }
  }

  const s = settings as {
    platform_fee_bps: number
    platform_fee_fixed_cents: number
    convenience_fee_bps?: number
    convenience_fee_fixed_cents?: number
  }

  const feeInputs: BlitzpayFeeInputs = {
    amountCents: BigInt(balanceDue),
    platformFeeBps: Math.max(0, Math.min(10_000, Number(s.platform_fee_bps) || 0)),
    platformFeeFixedCents: Math.max(0, Number(s.platform_fee_fixed_cents) || 0),
    convenienceFeeBps: s.convenience_fee_bps ?? 0,
    convenienceFeeFixedCents: s.convenience_fee_fixed_cents ?? 0,
  }

  let breakdown: ReturnType<typeof computeBlitzpayApplicationFeeBreakdown>
  try {
    breakdown = computeBlitzpayApplicationFeeBreakdown(feeInputs)
  } catch {
    return {
      ok: false,
      status: 500,
      code: "fee_invalid",
      message: "Fee configuration is invalid. Ask an admin to review BlitzPay fee settings.",
    }
  }

  const applicationFeeCents = Number(breakdown.computedTotalApplicationFeeCents)
  const attemptToken = buildPreparePayAttemptToken(input)
  const idempotencyKey = buildBlitzPayPaymentIntentIdempotencyKey({
    organizationId,
    orgInvoiceId: invoiceId,
    attemptToken,
  })

  const feeVersion = DEFAULT_BLITZPAY_FEE_POLICY_VERSION
  const paySrc = paymentSourceForMetadata(input)
  const meta = blitzpayInvoicePaymentMetadata({
    organizationId,
    orgInvoiceId: invoiceId,
    feePolicyVersion: feeVersion,
    paymentSource: paySrc,
  })

  const origin = getPublicAppOrigin().replace(/\/+$/, "")
  const successUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.successUrl
    : `${origin}/invoices?blitzpay=1&status=success&invoiceId=${encodeURIComponent(invoiceId)}`
  const cancelUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.cancelUrl
    : `${origin}/invoices?blitzpay=1&status=cancel&invoiceId=${encodeURIComponent(invoiceId)}`

  const productName = `Invoice ${inv.invoice_number} — ${inv.title}`.slice(0, 120)

  let session: Awaited<ReturnType<typeof createBlitzpayInvoiceCheckoutSession>>
  try {
    session = await createBlitzpayInvoiceCheckoutSession({
      stripeConnectAccountId: acct,
      amountCents: balanceDue,
      applicationFeeCents,
      currency: "usd",
      productName,
      successUrl,
      cancelUrl,
      paymentIntentMetadata: meta,
      sessionMetadata: meta,
      idempotencyKey,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ source: "blitzpay-prepare-pay", message: msg, organizationId }))
    return {
      ok: false,
      status: 502,
      code: "stripe_error",
      message: "Could not start Stripe Checkout. Try again or contact support.",
    }
  }

  const piRef = session.payment_intent
  const stripePiId = typeof piRef === "string" ? piRef : piRef && typeof piRef === "object" && "id" in piRef ? String((piRef as { id: string }).id) : ""
  if (!stripePiId) {
    return { ok: false, status: 502, code: "missing_payment_intent", message: "Stripe did not return a PaymentIntent for this session." }
  }

  const internalPiId = randomUUID()
  const attemptNo = await nextBlitzpayInvoicePaymentAttemptNo(admin, organizationId, invoiceId)

  try {
    await createBlitzpayPaymentIntentRecord(admin, {
      id: internalPiId,
      organizationId,
      stripeConnectAccountId: acct,
      stripePaymentIntentId: stripePiId,
      stripeCheckoutSessionId: session.id,
      status: "requires_payment_method",
      amountCents: BigInt(balanceDue),
      currency: "usd",
      applicationFeeCents: breakdown.computedTotalApplicationFeeCents,
      convenienceFeeCents: 0n,
      invoiceAmountCents: BigInt(balanceDue),
      orgInvoiceId: invoiceId,
      customerId: inv.customer_id,
      idempotencyKey,
      metadata: { ...meta, stripe_checkout_session_id: session.id },
    })

    await createBlitzpayFeeSnapshot(admin, {
      organizationId,
      blitzpayPaymentIntentId: internalPiId,
      feeInputs,
    })

    await createBlitzpayInvoicePaymentAttempt(admin, {
      organizationId,
      orgInvoiceId: invoiceId,
      blitzpayPaymentIntentId: internalPiId,
      attemptNo,
      channel: attemptChannel(input),
      createdByUserId: createdByUserId(input),
      portalAccessContext: portalAccessContext(input),
      status: "initiated",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "blitzpay-prepare-pay",
        phase: "db_after_stripe",
        message: msg,
        organizationId,
        stripeCheckoutSessionId: session.id,
      }),
    )
    return {
      ok: false,
      status: 500,
      code: "db_persist_failed",
      message: "Payment session started but workspace records failed. Contact support with the time of this attempt.",
    }
  }

  const url = session.url
  if (!url) {
    return { ok: false, status: 502, code: "missing_checkout_url", message: "Stripe did not return a Checkout URL." }
  }

  return {
    ok: true,
    data: {
      url,
      checkoutSessionId: session.id,
      stripePaymentIntentId: stripePiId,
      blitzpayPaymentIntentRowId: internalPiId,
    },
  }
}
