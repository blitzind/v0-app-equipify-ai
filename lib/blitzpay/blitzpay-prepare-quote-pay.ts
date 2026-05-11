import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
import { createBlitzpayInvoiceCheckoutSession } from "@/lib/blitzpay/connect-stripe"
import { computeBlitzpayApplicationFeeBreakdown, type BlitzpayFeeInputs } from "@/lib/blitzpay/fees"
import { buildBlitzPayQuotePaymentIntentIdempotencyKey } from "@/lib/blitzpay/idempotency-keys"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import {
  createBlitzpayFeeSnapshot,
  createBlitzpayInvoicePaymentAttempt,
  createBlitzpayPaymentIntentRecord,
  fetchBlitzpayOrgSettingsRow,
  nextBlitzpayQuotePaymentAttemptNo,
} from "@/lib/blitzpay/payment-repository"
import { blitzpayEstimateDepositMetadata } from "@/lib/blitzpay/blitzpay-estimate-stripe-metadata"
import { computeBlitzpayQuoteDepositTargetCents, quoteRemainingAfterDepositCents } from "@/lib/blitzpay/blitzpay-estimate-deposit-math"
import { tryConsumeBlitzpayPreparePaySlotsQuote } from "@/lib/blitzpay/blitzpay-rate-limit"
import { DEFAULT_BLITZPAY_FEE_POLICY_VERSION } from "@/lib/blitzpay/payment-domain"
import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"
import {
  computeBlitzpayConvenienceFeePreview,
  DEFAULT_BLITZPAY_DISCLOSURE_COPY,
  type BlitzpayConvenienceFeeSettings,
} from "@/lib/blitzpay/convenience-fees"

export type BlitzpayQuotePayPreview = {
  quoteTotalCents: number
  depositTargetCents: number
  depositCollectedCents: number
  remainingQuoteCents: number
  /** Total customer pays including convenience fee (selected method). */
  totalChargeCents: number
  convenienceFeeCents: number
  disclosureCopy: string
  connectChargesEnabled: boolean
  connectPayoutsEnabled: boolean
  connectStatus: string | null
  financingReady: boolean
  financingMessage: string
  availablePaymentMethods: Array<{
    type: BlitzpayPaymentMethodType
    label: string
    convenienceFeeCents: number
    totalChargeCents: number
    disclosureCopy: string
    timelineCopy: string | null
  }>
}

export type PrepareBlitzpayQuoteHostedCheckoutStaffInput = {
  admin: SupabaseClient
  organizationId: string
  quoteId: string
  initiatedBy: "staff_dashboard"
  userId: string
  preferredPaymentMethodType?: BlitzpayPaymentMethodType
}

export type PrepareBlitzpayQuoteHostedCheckoutPortalInput = {
  admin: SupabaseClient
  organizationId: string
  quoteId: string
  initiatedBy: "customer_portal"
  portalUserId: string
  portalCustomerId: string
  returnUrls: { successUrl: string; cancelUrl: string }
  preferredPaymentMethodType?: BlitzpayPaymentMethodType
  acknowledgeFuturePaymentAuthorization?: boolean
}

export type PrepareBlitzpayQuoteHostedCheckoutInput =
  | PrepareBlitzpayQuoteHostedCheckoutStaffInput
  | PrepareBlitzpayQuoteHostedCheckoutPortalInput

export type PrepareBlitzpayQuotePayResult = {
  url: string
  checkoutSessionId: string
  stripePaymentIntentId: string
  blitzpayPaymentIntentRowId: string
}

function convenienceSettingsFromRow(settings: Record<string, unknown>): BlitzpayConvenienceFeeSettings {
  const disclosure =
    typeof settings.blitzpay_fee_disclosure_copy === "string" && settings.blitzpay_fee_disclosure_copy.trim().length > 0
      ? settings.blitzpay_fee_disclosure_copy.trim()
      : DEFAULT_BLITZPAY_DISCLOSURE_COPY
  return {
    passProcessingFeesToCustomer: Boolean(settings.blitzpay_pass_processing_fees_to_customer),
    feeMode:
      typeof settings.blitzpay_fee_mode === "string" &&
      (settings.blitzpay_fee_mode === "customer_pass_through" ||
        settings.blitzpay_fee_mode === "customer_partial_pass_through")
        ? settings.blitzpay_fee_mode
        : "merchant_absorbs",
    feePercentageSnapshot: Math.max(0, Number(settings.blitzpay_fee_percentage_snapshot ?? 0)),
    feeCapCents:
      settings.blitzpay_fee_cap_cents == null ? null : Math.max(0, Math.round(Number(settings.blitzpay_fee_cap_cents))),
    disclosureCopy: disclosure,
  }
}

function enabledPaymentMethodsFromSettings(settings: Record<string, unknown>): BlitzpayPaymentMethodType[] {
  const cardEnabled = settings.blitzpay_payment_method_card_enabled !== false
  const achEnabled = Boolean(settings.blitzpay_payment_method_ach_enabled)
  const methods: BlitzpayPaymentMethodType[] = []
  if (cardEnabled) methods.push("card")
  if (achEnabled) methods.push("us_bank_account")
  if (methods.length === 0) methods.push("card")
  return methods
}

function achTimelineCopyFromSettings(settings: Record<string, unknown>): string {
  const raw = String(settings.blitzpay_ach_processing_timeline_copy ?? "").trim()
  return raw.length > 0 ? raw : "Bank (ACH) payments can take 3-5 business days to settle."
}

async function loadQuotePrepareContext(input: PrepareBlitzpayQuoteHostedCheckoutInput): Promise<
  | {
      settings: Record<string, unknown>
      orgRow: {
        stripe_connect_account_id?: string | null
        stripe_charges_enabled?: boolean
        stripe_connect_status?: string | null
        stripe_payouts_enabled?: boolean | null
      }
      quote: {
        id: string
        customer_id: string
        amount_cents: number
        status: string
        archived_at: string | null
        quote_number: string
        title: string
        blitzpay_deposit_mode: string
        blitzpay_deposit_fixed_cents: number | null
        blitzpay_deposit_percentage_bps: number | null
        blitzpay_deposit_collected_cents: number
        blitzpay_financing_ready: boolean
      }
      depositTargetCents: number
    }
  | { error: { ok: false; status: number; code: string; message: string } }
> {
  const { admin, organizationId, quoteId } = input
  const settings = await fetchBlitzpayOrgSettingsRow(admin, organizationId)
  if (!settings || !(settings as { blitzpay_invoice_pay_enabled?: boolean }).blitzpay_invoice_pay_enabled) {
    return {
      error: {
        ok: false,
        status: 403,
        code: "org_pay_disabled",
        message: "BlitzPay online pay is not enabled for this workspace.",
      },
    }
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_charges_enabled, stripe_connect_status, stripe_payouts_enabled")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return { error: { ok: false, status: 500, code: "org_load_failed", message: "Could not load workspace." } }
  }

  const acct = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  const chargesOk = Boolean((orgRow as { stripe_charges_enabled?: boolean }).stripe_charges_enabled)
  if (!acct || !chargesOk) {
    return {
      error: {
        ok: false,
        status: 409,
        code: "connect_not_ready",
        message: "Stripe Connect is not ready to accept charges. Finish BlitzPay onboarding in Settings → Payments.",
      },
    }
  }

  const { data: q, error: qErr } = await admin
    .from("org_quotes")
    .select(
      [
        "id",
        "customer_id",
        "amount_cents",
        "status",
        "archived_at",
        "quote_number",
        "title",
        "blitzpay_deposit_mode",
        "blitzpay_deposit_fixed_cents",
        "blitzpay_deposit_percentage_bps",
        "blitzpay_deposit_collected_cents",
        "blitzpay_financing_ready",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .eq("id", quoteId)
    .maybeSingle()

  if (qErr || !q) {
    return { error: { ok: false, status: 404, code: "quote_not_found", message: "Quote not found." } }
  }

  const quote = q as Record<string, unknown>
  if (quote.archived_at) {
    return { error: { ok: false, status: 409, code: "quote_archived", message: "This quote is archived." } }
  }
  const st = String(quote.status ?? "").toLowerCase()
  if (st === "declined" || st === "expired" || st === "draft") {
    return {
      error: { ok: false, status: 409, code: "quote_not_payable", message: "This quote cannot accept an online payment." },
    }
  }

  const customerId = String(quote.customer_id ?? "")
  if (input.initiatedBy === "customer_portal" && customerId !== input.portalCustomerId) {
    return { error: { ok: false, status: 404, code: "quote_not_found", message: "Quote not found." } }
  }

  const dep = computeBlitzpayQuoteDepositTargetCents({
    quoteAmountCents: Math.round(Number(quote.amount_cents ?? 0)),
    mode: String(quote.blitzpay_deposit_mode ?? "none") as "none" | "acceptance" | "fixed" | "percentage" | "full_prepay",
    fixedCents: quote.blitzpay_deposit_fixed_cents == null ? null : Math.round(Number(quote.blitzpay_deposit_fixed_cents)),
    percentageBps:
      quote.blitzpay_deposit_percentage_bps == null ? null : Math.round(Number(quote.blitzpay_deposit_percentage_bps)),
  })
  if (!dep.ok) {
    return { error: { ok: false, status: 409, code: dep.code, message: dep.message } }
  }

  const collected = Math.max(0, Math.round(Number(quote.blitzpay_deposit_collected_cents ?? 0)))
  const total = Math.round(Number(quote.amount_cents ?? 0))
  const remaining = quoteRemainingAfterDepositCents(total, collected)
  if (remaining <= 0 && String(quote.blitzpay_deposit_mode) !== "none") {
    return {
      error: {
        ok: false,
        status: 409,
        code: "quote_fully_paid",
        message: "This estimate is already fully paid online.",
      },
    }
  }

  const target = Math.min(dep.targetPayCents, Math.max(50, remaining))
  if (target < 50) {
    return {
      error: {
        ok: false,
        status: 409,
        code: "amount_below_minimum",
        message: "Remaining collectible is below the online payment minimum.",
      },
    }
  }

  return {
    settings: settings as Record<string, unknown>,
    orgRow: orgRow as {
      stripe_connect_account_id?: string | null
      stripe_charges_enabled?: boolean
      stripe_connect_status?: string | null
      stripe_payouts_enabled?: boolean | null
    },
    quote: {
      id: String(quote.id),
      customer_id: customerId,
      amount_cents: total,
      status: String(quote.status),
      archived_at: quote.archived_at ? String(quote.archived_at) : null,
      quote_number: String(quote.quote_number ?? ""),
      title: String(quote.title ?? ""),
      blitzpay_deposit_mode: String(quote.blitzpay_deposit_mode ?? "none"),
      blitzpay_deposit_fixed_cents:
        quote.blitzpay_deposit_fixed_cents == null ? null : Math.round(Number(quote.blitzpay_deposit_fixed_cents)),
      blitzpay_deposit_percentage_bps:
        quote.blitzpay_deposit_percentage_bps == null ? null : Math.round(Number(quote.blitzpay_deposit_percentage_bps)),
      blitzpay_deposit_collected_cents: collected,
      blitzpay_financing_ready: Boolean(quote.blitzpay_financing_ready),
    },
    depositTargetCents: target,
  }
}

function rateLimitPrincipalId(input: PrepareBlitzpayQuoteHostedCheckoutInput): string {
  return input.initiatedBy === "staff_dashboard" ? input.userId : `portal:${input.portalUserId}`
}

function buildPrepareQuoteAttemptToken(input: PrepareBlitzpayQuoteHostedCheckoutInput): string {
  const nonce = randomUUID().replace(/-/g, "")
  if (input.initiatedBy === "staff_dashboard") {
    return randomUUID()
  }
  const h = createHash("sha256")
    .update(`blitzpay_portal_quote_prepare:${input.portalUserId}:${nonce}`)
    .digest("hex")
    .slice(0, 24)
  return `qt_${h}_${nonce}`
}

function paymentSourceForMetadata(
  input: PrepareBlitzpayQuoteHostedCheckoutInput,
): "staff_dashboard" | "customer_portal" {
  return input.initiatedBy === "staff_dashboard" ? "staff_dashboard" : "customer_portal"
}

function portalAccessContext(input: PrepareBlitzpayQuoteHostedCheckoutInput): Record<string, unknown> | null {
  if (input.initiatedBy !== "customer_portal") return null
  return { payment_channel: "customer_portal", portal_user_id: input.portalUserId }
}

export async function previewBlitzpayQuoteHostedCheckout(
  input: PrepareBlitzpayQuoteHostedCheckoutInput,
): Promise<{ ok: true; data: BlitzpayQuotePayPreview } | { ok: false; status: number; code: string; message: string }> {
  if (!isBlitzPayInvoicePayEnabledEnv()) {
    return { ok: false, status: 403, code: "feature_disabled", message: "BlitzPay invoice pay is not enabled for this deployment." }
  }
  const ctx = await loadQuotePrepareContext(input)
  if ("error" in ctx) return ctx.error

  const convenience = convenienceSettingsFromRow(ctx.settings)
  const methods = enabledPaymentMethodsFromSettings(ctx.settings)
  const achTimeline = achTimelineCopyFromSettings(ctx.settings)
  const portion = ctx.depositTargetCents
  const methodPreviews = methods.map((method) => {
    const p = computeBlitzpayConvenienceFeePreview({
      invoiceBalanceCents: portion,
      settings: convenience,
      paymentMethodType: method,
      achConvenienceFeeEnabled: Boolean(ctx.settings.blitzpay_ach_convenience_fee_enabled),
    })
    return {
      type: method,
      label: method === "card" ? "Card" : "Bank transfer (ACH)",
      convenienceFeeCents: p.convenienceFeeCents,
      totalChargeCents: p.totalChargeCents,
      disclosureCopy: p.disclosureCopy,
      timelineCopy: method === "us_bank_account" ? achTimeline : null,
    }
  })
  const defaultMethod = methodPreviews[0]
  const remainingAfterThisCheckout = quoteRemainingAfterDepositCents(
    ctx.quote.amount_cents,
    ctx.quote.blitzpay_deposit_collected_cents + portion,
  )

  return {
    ok: true,
    data: {
      quoteTotalCents: ctx.quote.amount_cents,
      depositTargetCents: portion,
      depositCollectedCents: ctx.quote.blitzpay_deposit_collected_cents,
      remainingQuoteCents: remainingAfterThisCheckout,
      convenienceFeeCents: defaultMethod.convenienceFeeCents,
      totalChargeCents: defaultMethod.totalChargeCents,
      disclosureCopy: defaultMethod.disclosureCopy,
      connectChargesEnabled: Boolean(ctx.orgRow.stripe_charges_enabled),
      connectPayoutsEnabled: Boolean(ctx.orgRow.stripe_payouts_enabled),
      connectStatus: typeof ctx.orgRow.stripe_connect_status === "string" ? ctx.orgRow.stripe_connect_status : null,
      financingReady: ctx.quote.blitzpay_financing_ready,
      financingMessage: ctx.quote.blitzpay_financing_ready
        ? "Third-party financing may be offered in a future release. This payment is a standard card or bank transfer."
        : "Pay the deposit or full amount with card or ACH. Financing integrations are not enabled yet.",
      availablePaymentMethods: methodPreviews,
    },
  }
}

export async function prepareBlitzpayQuoteHostedCheckout(
  input: PrepareBlitzpayQuoteHostedCheckoutInput,
): Promise<{ ok: true; data: PrepareBlitzpayQuotePayResult } | { ok: false; status: number; code: string; message: string }> {
  const { admin, organizationId, quoteId } = input

  if (!isBlitzPayInvoicePayEnabledEnv()) {
    return { ok: false, status: 403, code: "feature_disabled", message: "BlitzPay invoice pay is not enabled for this deployment." }
  }

  const rate = await tryConsumeBlitzpayPreparePaySlotsQuote(admin, {
    organizationId,
    quoteId,
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

  const loaded = await loadQuotePrepareContext(input)
  if ("error" in loaded) return loaded.error
  const { settings, orgRow, quote, depositTargetCents: portion } = loaded

  if (input.initiatedBy === "customer_portal") {
    const allowSave = Boolean((settings as Record<string, unknown>).blitzpay_allow_save_payment_methods ?? true)
    if (allowSave && !input.acknowledgeFuturePaymentAuthorization) {
      return {
        ok: false,
        status: 400,
        code: "consent_required",
        message: "Confirm future payment authorization before continuing to Stripe Checkout.",
      }
    }
  }

  const acct = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  const enabledMethods = enabledPaymentMethodsFromSettings(settings as Record<string, unknown>)
  const selectedMethod =
    input.preferredPaymentMethodType && enabledMethods.includes(input.preferredPaymentMethodType) ?
      input.preferredPaymentMethodType
    : enabledMethods[0]
  const checkoutMethodTypes = input.preferredPaymentMethodType ? [selectedMethod] : enabledMethods
  const allowSavePaymentMethod =
    Boolean((settings as Record<string, unknown>).blitzpay_allow_save_payment_methods ?? true) &&
    (input.initiatedBy !== "customer_portal" || Boolean(input.acknowledgeFuturePaymentAuthorization))

  const conveniencePreview = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: portion,
    settings: convenienceSettingsFromRow(settings as Record<string, unknown>),
    paymentMethodType: selectedMethod,
    achConvenienceFeeEnabled: Boolean((settings as Record<string, unknown>).blitzpay_ach_convenience_fee_enabled),
  })

  const s = settings as {
    platform_fee_bps: number
    platform_fee_fixed_cents: number
  }

  const feeInputs: BlitzpayFeeInputs = {
    amountCents: BigInt(conveniencePreview.totalChargeCents),
    platformFeeBps: Math.max(0, Math.min(10_000, Number(s.platform_fee_bps) || 0)),
    platformFeeFixedCents: Math.max(0, Number(s.platform_fee_fixed_cents) || 0),
    convenienceFeeBps: 0,
    convenienceFeeFixedCents: 0,
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
  const attemptToken = buildPrepareQuoteAttemptToken(input)
  const idempotencyKey = buildBlitzPayQuotePaymentIntentIdempotencyKey({
    organizationId,
    orgQuoteId: quoteId,
    attemptToken,
  })

  const feeVersion = DEFAULT_BLITZPAY_FEE_POLICY_VERSION
  const paySrc = paymentSourceForMetadata(input)
  const meta = blitzpayEstimateDepositMetadata({
    organizationId,
    orgQuoteId: quoteId,
    feePolicyVersion: feeVersion,
    paymentSource: paySrc,
    quotePayCents: portion,
  })

  const origin = getPublicAppOrigin().replace(/\/+$/, "")
  const successUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.successUrl
    : `${origin}/quotes?blitzpay=1&status=success&quoteId=${encodeURIComponent(quoteId)}`
  const cancelUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.cancelUrl
    : `${origin}/quotes?blitzpay=1&status=cancel&quoteId=${encodeURIComponent(quoteId)}`

  const productName = `Quote ${quote.quote_number} — ${quote.title}`.slice(0, 120)

  let savedStripeCustomerId: string | null = null
  if (quote.customer_id) {
    const { data: profile } = await admin
      .from("blitzpay_customer_payment_profiles")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .eq("customer_id", quote.customer_id)
      .maybeSingle()
    const candidate = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    savedStripeCustomerId = candidate ? String(candidate).trim() : null
  }

  let session: Awaited<ReturnType<typeof createBlitzpayInvoiceCheckoutSession>>
  try {
    session = await createBlitzpayInvoiceCheckoutSession({
      stripeConnectAccountId: acct,
      amountCents: conveniencePreview.totalChargeCents,
      applicationFeeCents,
      currency: "usd",
      productName,
      successUrl,
      cancelUrl,
      paymentIntentMetadata: meta,
      sessionMetadata: meta,
      idempotencyKey,
      paymentMethodTypes: checkoutMethodTypes,
      stripeCustomerId: savedStripeCustomerId,
      savePaymentMethodForFutureUse: allowSavePaymentMethod,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ source: "blitzpay-prepare-quote-pay", message: msg, organizationId }))
    return {
      ok: false,
      status: 502,
      code: "stripe_error",
      message: "Could not start Stripe Checkout. Try again or contact support.",
    }
  }

  const piRef = session.payment_intent
  const stripePiId =
    typeof piRef === "string" ? piRef : piRef && typeof piRef === "object" && "id" in piRef ? String((piRef as { id: string }).id) : ""
  if (!stripePiId) {
    return { ok: false, status: 502, code: "missing_payment_intent", message: "Stripe did not return a PaymentIntent for this session." }
  }

  const internalPiId = randomUUID()
  const attemptNo = await nextBlitzpayQuotePaymentAttemptNo(admin, organizationId, quoteId)

  try {
    await createBlitzpayPaymentIntentRecord(admin, {
      id: internalPiId,
      organizationId,
      stripeConnectAccountId: acct,
      stripePaymentIntentId: stripePiId,
      stripeCheckoutSessionId: session.id,
      status: "requires_payment_method",
      amountCents: BigInt(portion),
      currency: "usd",
      applicationFeeCents: breakdown.computedTotalApplicationFeeCents,
      convenienceFeeCents: BigInt(conveniencePreview.convenienceFeeCents),
      invoiceAmountCents: BigInt(portion),
      orgInvoiceId: null,
      orgQuoteId: quoteId,
      customerId: quote.customer_id,
      idempotencyKey,
      metadata: { ...meta, stripe_checkout_session_id: session.id },
      paymentMethodType: selectedMethod,
      stripeCustomerId: savedStripeCustomerId,
      savePaymentMethodRequested: allowSavePaymentMethod,
    })

    await createBlitzpayFeeSnapshot(admin, {
      organizationId,
      blitzpayPaymentIntentId: internalPiId,
      feeInputs,
    })

    await createBlitzpayInvoicePaymentAttempt(admin, {
      organizationId,
      orgInvoiceId: null,
      orgQuoteId: quoteId,
      blitzpayPaymentIntentId: internalPiId,
      attemptNo,
      channel: input.initiatedBy === "staff_dashboard" ? "checkout" : "portal_link",
      createdByUserId: input.initiatedBy === "staff_dashboard" ? input.userId : null,
      portalAccessContext: portalAccessContext(input),
      status: "initiated",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ source: "blitzpay-prepare-quote-pay", phase: "db_after_stripe", message: msg, organizationId }))
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
