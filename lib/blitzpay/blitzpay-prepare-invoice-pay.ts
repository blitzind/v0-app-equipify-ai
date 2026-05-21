import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
import {
  buildBlitzpayInvoiceCheckoutSessionApiBody,
  connectCheckoutCustomerExists,
  createBlitzpayInvoiceCheckoutSession,
  retrieveConnectAccount,
  stripePaymentIntentIdFromCheckoutSession,
} from "@/lib/blitzpay/connect-stripe"
import {
  buildBlitzpayStaffInvoiceCheckoutReturnUrls,
  blitzpayCheckoutReturnUrlDevFlags,
} from "@/lib/blitzpay/blitzpay-checkout-return-urls"
import {
  connectedAccountSupportsAch,
  filterPaymentMethodsForConnectedAccount,
  isStripeInvalidPaymentMethodTypeError,
  paymentMethodsEnabledInOrgSettings,
  resolveBlitzpayCheckoutPaymentMethods,
} from "@/lib/blitzpay/blitzpay-checkout-payment-method-types"
import { computeBlitzpayApplicationFeeBreakdown, type BlitzpayFeeInputs } from "@/lib/blitzpay/fees"
import { buildBlitzPayPaymentIntentIdempotencyKey } from "@/lib/blitzpay/idempotency-keys"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import {
  assertInvoicePayableForBlitzpay,
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import {
  createBlitzpayFeeSnapshot,
  createBlitzpayInvoicePaymentAttempt,
  createBlitzpayPaymentIntentRecord,
  fetchBlitzpayOrgSettingsRow,
  nextBlitzpayInvoicePaymentAttemptNo,
} from "@/lib/blitzpay/payment-repository"
import { blitzpayInvoicePaymentMetadata } from "@/lib/blitzpay/stripe-metadata"
import {
  formatStripeCheckoutFailureMessage,
  logBlitzpayPreparePayDev,
  logBlitzpayPreparePayPersistFailed,
  logBlitzpayStripeCheckoutFailed,
  logBlitzpayStripeCheckoutPayload,
} from "@/lib/blitzpay/blitzpay-prepare-pay-dev-log"
import { tryConsumeBlitzpayPreparePaySlots } from "@/lib/blitzpay/blitzpay-rate-limit"
import { fetchBlitzpayInvoicePhase2kDashboard } from "@/lib/blitzpay/blitzpay-invoice-phase2k-dashboard"
import type { BlitzpayInvoicePhase2kDashboard } from "@/lib/blitzpay/blitzpay-invoice-phase2k-dashboard"
import { DEFAULT_BLITZPAY_FEE_POLICY_VERSION } from "@/lib/blitzpay/payment-domain"
import type { BlitzpayInvoicePayChannel } from "@/lib/blitzpay/payment-domain"
import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"
import {
  computeBlitzpayConvenienceFeePreview,
  DEFAULT_BLITZPAY_DISCLOSURE_COPY,
  type BlitzpayConvenienceFeeSettings,
  type BlitzpayConvenienceFeePreview,
} from "@/lib/blitzpay/convenience-fees"
import {
  clampInvoicePortionCents,
  effectivePartialPaymentsEnabled,
  remainingBalanceAfterPortion,
} from "@/lib/blitzpay/blitzpay-phase2k-partial-math"

export type PrepareBlitzpayInvoicePayResult = {
  url: string
  checkoutSessionId: string
  stripePaymentIntentId: string | null
  blitzpayPaymentIntentRowId: string
}

export type BlitzpayCheckoutDisclosurePreview = {
  /** Full invoice balance due before this checkout (unchanged semantics for callers). */
  invoiceBalanceCents: number
  /** Portion of the invoice balance this checkout pays toward (full balance unless partial pay is enabled). */
  paymentTowardInvoiceCents: number
  /** Invoice balance remaining after this payment succeeds (estimate; excludes concurrent payments). */
  remainingBalanceAfterPaymentCents: number
  convenienceFeeCents: number
  totalChargeCents: number
  appliesToCustomer: boolean
  disclosureCopy: string
  connectChargesEnabled: boolean
  connectPayoutsEnabled: boolean
  connectStatus: string | null
  savePaymentMethodEligible: boolean
  availablePaymentMethods: Array<{
    type: BlitzpayPaymentMethodType
    label: string
    convenienceFeeCents: number
    totalChargeCents: number
    disclosureCopy: string
    timelineCopy: string | null
  }>
  phase2k: BlitzpayInvoicePhase2kDashboard | null
}

type PrepareBlitzpayInvoiceHostedCheckoutStaffInput = {
  admin: SupabaseClient
  organizationId: string
  invoiceId: string
  initiatedBy: "staff_dashboard"
  userId: string
  preferredPaymentMethodType?: BlitzpayPaymentMethodType
  /** Card-only Checkout unless ACH is explicitly requested (Equipify Mobile default). */
  defaultCardOnlyUnlessExplicitAch?: boolean
  /** When partial payments are enabled, pay up to this amount toward the invoice (cents). */
  invoicePortionCents?: number | null
  /** Required when saving a payment method for future use from the portal. */
  acknowledgeFuturePaymentAuthorization?: boolean
}

type PrepareBlitzpayInvoiceHostedCheckoutPortalInput = {
  admin: SupabaseClient
  organizationId: string
  invoiceId: string
  initiatedBy: "customer_portal"
  portalUserId: string
  portalCustomerId: string
  returnUrls: { successUrl: string; cancelUrl: string }
  preferredPaymentMethodType?: BlitzpayPaymentMethodType
  invoicePortionCents?: number | null
  acknowledgeFuturePaymentAuthorization?: boolean
}

export type PrepareBlitzpayInvoiceHostedCheckoutInput =
  | PrepareBlitzpayInvoiceHostedCheckoutStaffInput
  | PrepareBlitzpayInvoiceHostedCheckoutPortalInput

function errCode(e: unknown): string {
  return e instanceof Error ? e.message : "prepare_failed"
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

function achTimelineCopyFromSettings(settings: Record<string, unknown>): string {
  const raw = String(settings.blitzpay_ach_processing_timeline_copy ?? "").trim()
  return raw.length > 0 ? raw : "Bank (ACH) payments can take 3-5 business days to settle."
}

async function loadPrepareContext(input: PrepareBlitzpayInvoiceHostedCheckoutInput): Promise<
  | {
      settings: Record<string, unknown>
      orgRow: { stripe_connect_account_id?: string | null; stripe_charges_enabled?: boolean; stripe_connect_status?: string | null; stripe_payouts_enabled?: boolean | null }
      inv: Awaited<ReturnType<typeof loadInvoiceForBlitzpayPay>>
      paidSum: number
      balanceDue: number
      checkoutInvoicePortionCents: number
    }
  | { error: { ok: false; status: number; code: string; message: string } }
> {
  const { admin, organizationId, invoiceId } = input
  const settings = await fetchBlitzpayOrgSettingsRow(admin, organizationId)
  if (!settings || !(settings as { blitzpay_invoice_pay_enabled?: boolean }).blitzpay_invoice_pay_enabled) {
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "org_pay_disabled",
      orgBlitzpayEnabled: false,
    })
    return {
      error: {
        ok: false,
        status: 403,
        code: "org_pay_disabled",
        message: "BlitzPay is disabled for this organization.",
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
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "connect_not_ready",
      connectAccountPresent: Boolean(acct),
      chargesEnabled: chargesOk,
    })
    return {
      error: {
        ok: false,
        status: 409,
        code: "connect_not_ready",
        message: "Stripe Connect onboarding incomplete.",
      },
    }
  }

  const inv = await loadInvoiceForBlitzpayPay(admin, organizationId, invoiceId)
  if (!inv) {
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "invoice_not_found",
      invoiceFound: false,
    })
    return { error: { ok: false, status: 404, code: "invoice_not_found", message: "Invoice not found." } }
  }
  if (input.initiatedBy === "customer_portal" && inv.customer_id !== input.portalCustomerId) {
    return { error: { ok: false, status: 404, code: "invoice_not_found", message: "Invoice not found." } }
  }
  const paidSum = await sumNetRecordedPaymentsCentsForBlitzpay(admin, organizationId, invoiceId)
  try {
    assertInvoicePayableForBlitzpay(inv, paidSum)
  } catch (e) {
    const code = errCode(e)
    const map: Record<string, string> = {
      invoice_archived: "This invoice is archived.",
      invoice_not_payable_status: "Invoice not eligible.",
      invoice_no_balance_due: "Invoice already paid.",
    }
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: code,
      invoiceFound: true,
      invoiceStatus: inv.status,
      balanceDueCents: balanceDueCentsForBlitzpay(inv, paidSum),
    })
    return {
      error: {
        ok: false,
        status: 409,
        code,
        message: map[code] ?? "Invoice not eligible.",
      },
    }
  }
  const balanceDue = balanceDueCentsForBlitzpay(inv, paidSum)
  if (balanceDue < 50) {
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "amount_below_minimum",
      invoiceFound: true,
      invoiceStatus: inv.status,
      balanceDueCents: balanceDue,
    })
    return {
      error: {
        ok: false,
        status: 409,
        code: "amount_below_minimum",
        message: "Invoice balance too low.",
      },
    }
  }

  const partialPolicy = {
    orgPartialEnabled: Boolean((settings as { blitzpay_partial_payments_enabled?: boolean }).blitzpay_partial_payments_enabled),
    platformPartialAllowed:
      (settings as { blitzpay_platform_partial_payments_allowed?: boolean }).blitzpay_platform_partial_payments_allowed !== false,
    minPortionCents: Math.max(50, Math.round(Number((settings as { blitzpay_partial_payment_min_cents?: number }).blitzpay_partial_payment_min_cents ?? 50))),
  }
  const partialOn = effectivePartialPaymentsEnabled(partialPolicy)
  const portionRaw = "invoicePortionCents" in input ? input.invoicePortionCents : undefined
  const portionClamp = clampInvoicePortionCents({
    balanceDueCents: balanceDue,
    requestedPortionCents: portionRaw,
    partialEnabled: partialOn,
    minPortionCents: partialPolicy.minPortionCents,
  })
  if (!portionClamp.ok) {
    const code = portionClamp.code
    const map: Record<string, string> = {
      balance_below_minimum: "Balance due is too low for this payment amount.",
      partial_not_allowed: "Partial online payments are not enabled for this workspace.",
      portion_below_minimum: portionClamp.message,
      portion_exceeds_balance: portionClamp.message,
    }
    return {
      error: {
        ok: false,
        status: 409,
        code,
        message: map[code] ?? portionClamp.message,
      },
    }
  }
  const checkoutInvoicePortionCents = portionClamp.portionCents

  return {
    settings: settings as Record<string, unknown>,
    orgRow: orgRow as { stripe_connect_account_id?: string | null; stripe_charges_enabled?: boolean; stripe_connect_status?: string | null; stripe_payouts_enabled?: boolean | null },
    inv,
    paidSum,
    balanceDue,
    checkoutInvoicePortionCents,
  }
}

export async function previewBlitzpayInvoiceHostedCheckout(
  input: PrepareBlitzpayInvoiceHostedCheckoutInput,
): Promise<{ ok: true; data: BlitzpayCheckoutDisclosurePreview } | { ok: false; status: number; code: string; message: string }> {
  if (!isBlitzPayInvoicePayEnabledEnv()) {
    return { ok: false, status: 403, code: "feature_disabled", message: "BlitzPay invoice pay is not enabled for this deployment." }
  }
  const ctx = await loadPrepareContext(input)
  if ("error" in ctx) return ctx.error

  const convenience = convenienceSettingsFromRow(ctx.settings)
  const acct = String((ctx.orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  let connectAccountSupportsAchFlag = false
  if (acct) {
    try {
      const stripeAccount = await retrieveConnectAccount(acct)
      connectAccountSupportsAchFlag = connectedAccountSupportsAch(stripeAccount)
    } catch {
      connectAccountSupportsAchFlag = false
    }
  }
  const previewMethods = filterPaymentMethodsForConnectedAccount({
    settingsMethods: paymentMethodsEnabledInOrgSettings(ctx.settings),
    connectAccountSupportsAch: connectAccountSupportsAchFlag,
  })
  const achTimeline = achTimelineCopyFromSettings(ctx.settings)
  const portion = ctx.checkoutInvoicePortionCents
  const remainingAfter = remainingBalanceAfterPortion(ctx.balanceDue, portion)
  const methodPreviews = previewMethods.map((method) => {
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
  let phase2k: BlitzpayInvoicePhase2kDashboard | null = null
  if (ctx.inv.customer_id) {
    phase2k = await fetchBlitzpayInvoicePhase2kDashboard(
      input.admin,
      input.organizationId,
      input.invoiceId,
      ctx.inv.customer_id,
    )
  }
  return {
    ok: true,
    data: {
      invoiceBalanceCents: ctx.balanceDue,
      paymentTowardInvoiceCents: portion,
      remainingBalanceAfterPaymentCents: remainingAfter,
      convenienceFeeCents: defaultMethod.convenienceFeeCents,
      totalChargeCents: defaultMethod.totalChargeCents,
      appliesToCustomer: defaultMethod.convenienceFeeCents > 0,
      disclosureCopy: defaultMethod.disclosureCopy,
      connectChargesEnabled: Boolean(ctx.orgRow.stripe_charges_enabled),
      connectPayoutsEnabled: Boolean(ctx.orgRow.stripe_payouts_enabled),
      connectStatus: typeof ctx.orgRow.stripe_connect_status === "string" ? ctx.orgRow.stripe_connect_status : null,
      savePaymentMethodEligible: Boolean(ctx.settings.blitzpay_allow_save_payment_methods ?? true),
      availablePaymentMethods: methodPreviews,
      phase2k,
    },
  }
}

function buildPreparePayAttemptToken(input: PrepareBlitzpayInvoiceHostedCheckoutInput): string {
  const nonce = randomUUID().replace(/-/g, "")
  if (input.initiatedBy === "staff_dashboard") {
    return randomUUID()
  }
  const portion =
    "invoicePortionCents" in input && input.invoicePortionCents != null ? Math.round(Number(input.invoicePortionCents)) : 0
  const h = createHash("sha256")
    .update(`blitzpay_portal_prepare:${input.portalUserId}:${portion}:${nonce}`)
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
  const loaded = await loadPrepareContext(input)
  if ("error" in loaded) return loaded.error
  const { orgRow, inv, balanceDue, checkoutInvoicePortionCents } = loaded
  const portion = checkoutInvoicePortionCents
  if (!settings) {
    return { ok: false, status: 500, code: "settings_missing", message: "BlitzPay settings are unavailable." }
  }
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
  let connectAccountSupportsAchFlag = false
  try {
    const stripeAccount = await retrieveConnectAccount(acct)
    connectAccountSupportsAchFlag = connectedAccountSupportsAch(stripeAccount)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logBlitzpayPreparePayDev("connect_account_capability_lookup_failed", {
      organizationId,
      invoiceId,
      connectedAccountId: acct,
      stripeError: msg.slice(0, 240),
    })
  }

  let paymentResolution = resolveBlitzpayCheckoutPaymentMethods({
    settings: settings as Record<string, unknown>,
    connectAccountSupportsAch: connectAccountSupportsAchFlag,
    preferredPaymentMethodType: input.preferredPaymentMethodType,
    defaultCardOnlyUnlessExplicitAch:
      input.initiatedBy === "staff_dashboard" ?
        Boolean(input.defaultCardOnlyUnlessExplicitAch)
      : false,
  })
  let selectedMethod = paymentResolution.selectedMethod
  let checkoutMethodTypes = paymentResolution.selectedPaymentMethods
  let achEnabled = paymentResolution.achEnabled
  const allowSavePaymentMethod =
    Boolean((settings as Record<string, unknown>).blitzpay_allow_save_payment_methods ?? true) &&
    (input.initiatedBy !== "customer_portal" || Boolean(input.acknowledgeFuturePaymentAuthorization))
  let conveniencePreview = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: portion,
    settings: convenienceSettingsFromRow(settings as Record<string, unknown>),
    paymentMethodType: selectedMethod,
    achConvenienceFeeEnabled: Boolean((settings as Record<string, unknown>).blitzpay_ach_convenience_fee_enabled),
  })

  const s = settings as {
    platform_fee_bps: number
    platform_fee_fixed_cents: number
    convenience_fee_bps?: number
    convenience_fee_fixed_cents?: number
  }

  let feeInputs: BlitzpayFeeInputs = {
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

  let applicationFeeCents = Number(breakdown.computedTotalApplicationFeeCents)
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
  const staffReturnUrls = buildBlitzpayStaffInvoiceCheckoutReturnUrls(origin, invoiceId)
  const successUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.successUrl
    : staffReturnUrls.successUrl
  const cancelUrl =
    input.initiatedBy === "customer_portal" ?
      input.returnUrls.cancelUrl
    : staffReturnUrls.cancelUrl
  const returnUrlFlags = blitzpayCheckoutReturnUrlDevFlags(successUrl, cancelUrl)
  logBlitzpayPreparePayDev("stripe_checkout_return_urls", {
    organizationId,
    invoiceId,
    initiatedBy: input.initiatedBy,
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...returnUrlFlags,
  })

  const productName = `Invoice ${inv.invoice_number} — ${inv.title}`.slice(0, 120)
  let savedStripeCustomerId: string | null = null
  if (inv.customer_id) {
    const { data: profile } = await admin
      .from("blitzpay_customer_payment_profiles")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .eq("customer_id", inv.customer_id)
      .maybeSingle()
    const candidate = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    savedStripeCustomerId = candidate ? String(candidate).trim() : null
  }

  if (savedStripeCustomerId) {
    const customerOk = await connectCheckoutCustomerExists({
      stripeConnectAccountId: acct,
      stripeCustomerId: savedStripeCustomerId,
    })
    if (!customerOk) {
      logBlitzpayPreparePayDev("stripe_checkout_customer_omitted", {
        organizationId,
        invoiceId,
        reason: "connect_customer_not_found",
      })
      savedStripeCustomerId = null
    }
  }

  let session: Awaited<ReturnType<typeof createBlitzpayInvoiceCheckoutSession>>
  let retryCardOnly = false
  let checkoutIdempotencyKey = idempotencyKey

  const logCheckoutPaymentMethods = () => {
    console.info(
      JSON.stringify({
        source: "blitzpay-prepare-pay",
        event: "stripe_checkout_final_payment_method_types",
        organizationId,
        invoiceId,
        initiatedBy: input.initiatedBy,
        payment_method_types: checkoutMethodTypes,
        selectedPaymentMethods: checkoutMethodTypes,
        connectedAccountId: acct,
        achEnabled,
        retryCardOnly,
        defaultCardOnlyUnlessExplicitAch:
          input.initiatedBy === "staff_dashboard" ? Boolean(input.defaultCardOnlyUnlessExplicitAch) : false,
        preferredPaymentMethodType: input.preferredPaymentMethodType ?? null,
        timestamp: new Date().toISOString(),
      }),
    )
    logBlitzpayPreparePayDev("stripe_checkout_payment_methods", {
      selectedPaymentMethods: checkoutMethodTypes,
      connectedAccountId: acct,
      achEnabled,
      retryCardOnly,
    })
  }

  const buildCheckoutSessionParams = () => ({
    stripeConnectAccountId: acct,
    amountCents: conveniencePreview.totalChargeCents,
    applicationFeeCents,
    currency: "usd" as const,
    productName,
    successUrl,
    cancelUrl,
    paymentIntentMetadata: meta,
    sessionMetadata: meta,
    idempotencyKey: checkoutIdempotencyKey,
    paymentMethodTypes: checkoutMethodTypes,
    stripeCustomerId: savedStripeCustomerId,
    savePaymentMethodForFutureUse: allowSavePaymentMethod,
  })

  const switchToCardOnlyCheckout = () => {
    retryCardOnly = true
    achEnabled = false
    checkoutMethodTypes = ["card"]
    selectedMethod = "card"
    conveniencePreview = computeBlitzpayConvenienceFeePreview({
      invoiceBalanceCents: portion,
      settings: convenienceSettingsFromRow(settings as Record<string, unknown>),
      paymentMethodType: selectedMethod,
      achConvenienceFeeEnabled: Boolean((settings as Record<string, unknown>).blitzpay_ach_convenience_fee_enabled),
    })
    feeInputs = {
      ...feeInputs,
      amountCents: BigInt(conveniencePreview.totalChargeCents),
    }
    breakdown = computeBlitzpayApplicationFeeBreakdown(feeInputs)
    applicationFeeCents = Number(breakdown.computedTotalApplicationFeeCents)
    checkoutIdempotencyKey = `${idempotencyKey}:card_only`
  }

  logBlitzpayPreparePayDev("stripe_checkout_attempt", {
    organizationId,
    invoiceId,
    invoiceStatus: inv.status,
    balanceDueCents: balanceDue,
    checkoutPortionCents: portion,
    connectAccountPresent: Boolean(acct),
    chargesEnabled: Boolean(orgRow.stripe_charges_enabled),
    totalChargeCents: conveniencePreview.totalChargeCents,
  })
  logCheckoutPaymentMethods()

  const logCheckoutPayload = () => {
    const sessionBody = buildBlitzpayInvoiceCheckoutSessionApiBody(buildCheckoutSessionParams())
    logBlitzpayStripeCheckoutPayload({
      payment_method_types: sessionBody.payment_method_types,
      mode: sessionBody.mode,
      success_url: sessionBody.success_url,
      cancel_url: sessionBody.cancel_url,
      success_url_exists: returnUrlFlags.success_url_exists,
      cancel_url_exists: returnUrlFlags.cancel_url_exists,
      customer: sessionBody.customer ?? null,
      customer_email: sessionBody.customer_email ?? null,
      customer_creation: sessionBody.customer_creation ?? null,
      payment_intent_data: {
        application_fee_amount: sessionBody.payment_intent_data.application_fee_amount,
        setup_future_usage: sessionBody.payment_intent_data.setup_future_usage,
        metadata_keys: Object.keys(sessionBody.payment_intent_data.metadata),
      },
      transfer_data: null,
      invoiceId,
      organizationId,
      stripeAccount: acct,
      application_fee_amount: applicationFeeCents,
      initiatedBy: input.initiatedBy,
    })
  }

  logCheckoutPayload()

  try {
    session = await createBlitzpayInvoiceCheckoutSession(buildCheckoutSessionParams())
  } catch (e) {
    if (isStripeInvalidPaymentMethodTypeError(e) && checkoutMethodTypes.includes("us_bank_account")) {
      switchToCardOnlyCheckout()
      logCheckoutPaymentMethods()
      logCheckoutPayload()
      try {
        session = await createBlitzpayInvoiceCheckoutSession(buildCheckoutSessionParams())
      } catch (retryErr) {
        const userMessage = formatStripeCheckoutFailureMessage(retryErr)
        logBlitzpayStripeCheckoutFailed({
          error: retryErr,
          organizationId,
          invoiceId,
          blockReason: "stripe_error",
          userMessage,
          retryCardOnly: true,
        })
        return {
          ok: false,
          status: 502,
          code: "stripe_error",
          message: userMessage,
        }
      }
    } else {
      const userMessage = formatStripeCheckoutFailureMessage(e)
      logBlitzpayStripeCheckoutFailed({
        error: e,
        organizationId,
        invoiceId,
        blockReason: "stripe_error",
        userMessage,
        retryCardOnly,
      })
      return {
        ok: false,
        status: 502,
        code: "stripe_error",
        message: userMessage,
      }
    }
  }

  logBlitzpayPreparePayDev("stripe_checkout_created", {
    organizationId,
    invoiceId,
    checkoutSessionId: session.id,
    checkoutUrlPresent: Boolean(session.url),
    paymentIntentPresent: Boolean(stripePaymentIntentIdFromCheckoutSession(session)),
  })

  const stripePiId = stripePaymentIntentIdFromCheckoutSession(session)
  const checkoutUrl = session.url
  if (!stripePiId && checkoutUrl) {
    logBlitzpayPreparePayDev("missing_payment_intent_deferred", {
      organizationId,
      invoiceId,
      checkoutSessionId: session.id,
      checkoutUrlPresent: true,
    })
  }
  if (!stripePiId && !checkoutUrl) {
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "missing_payment_intent",
      checkoutSessionId: session.id,
    })
    return {
      ok: false,
      status: 502,
      code: "missing_payment_intent",
      message: "Checkout session creation failed.",
    }
  }

  const internalPiId = randomUUID()
  const attemptNo = await nextBlitzpayInvoicePaymentAttemptNo(admin, organizationId, invoiceId)

  const persistContext = {
    organizationId,
    invoiceId,
    checkoutSessionId: session.id,
    checkoutSessionPresent: Boolean(session.id),
    stripePaymentIntentId: stripePiId ?? null,
    stripePaymentIntentPresent: Boolean(stripePiId),
    internalPiId,
    attemptNo,
  }

  let blitzpayPaymentIntentRowId = internalPiId

  try {
    const piRow = await createBlitzpayPaymentIntentRecord(admin, {
      id: internalPiId,
      organizationId,
      stripeConnectAccountId: acct,
      stripePaymentIntentId: stripePiId ?? null,
      stripeCheckoutSessionId: session.id,
      status: "requires_payment_method",
      amountCents: BigInt(portion),
      currency: "usd",
      applicationFeeCents: breakdown.computedTotalApplicationFeeCents,
      convenienceFeeCents: BigInt(conveniencePreview.convenienceFeeCents),
      invoiceAmountCents: BigInt(portion),
      orgInvoiceId: invoiceId,
      customerId: inv.customer_id,
      idempotencyKey: checkoutIdempotencyKey,
      metadata: { ...meta, stripe_checkout_session_id: session.id },
      paymentMethodType: selectedMethod,
      stripeCustomerId: savedStripeCustomerId,
      savePaymentMethodRequested: allowSavePaymentMethod,
    })
    blitzpayPaymentIntentRowId = piRow.id
  } catch (e) {
    logBlitzpayPreparePayPersistFailed({
      step: "create_blitzpay_payment_intent",
      table: "blitzpay_payment_intents",
      action: "insert",
      error: e,
      ...persistContext,
    })
    return {
      ok: false,
      status: 500,
      code: "db_persist_failed",
      message: "Payment session started but workspace records failed. Contact support with the time of this attempt.",
    }
  }

  try {
    await createBlitzpayFeeSnapshot(admin, {
      organizationId,
      blitzpayPaymentIntentId: blitzpayPaymentIntentRowId,
      feeInputs,
    })
  } catch (e) {
    logBlitzpayPreparePayPersistFailed({
      step: "create_blitzpay_fee_snapshot",
      table: "blitzpay_fee_snapshots",
      action: "insert",
      error: e,
      ...persistContext,
      blitzpayPaymentIntentRowId,
    })
    return {
      ok: false,
      status: 500,
      code: "db_persist_failed",
      message: "Payment session started but workspace records failed. Contact support with the time of this attempt.",
    }
  }

  try {
    await createBlitzpayInvoicePaymentAttempt(admin, {
      organizationId,
      orgInvoiceId: invoiceId,
      blitzpayPaymentIntentId: blitzpayPaymentIntentRowId,
      attemptNo,
      channel: attemptChannel(input),
      createdByUserId: createdByUserId(input),
      portalAccessContext: portalAccessContext(input),
      status: "initiated",
    })
  } catch (e) {
    logBlitzpayPreparePayPersistFailed({
      step: "create_blitzpay_invoice_payment_attempt",
      table: "blitzpay_invoice_payment_attempts",
      action: "insert",
      error: e,
      ...persistContext,
      blitzpayPaymentIntentRowId,
    })
    return {
      ok: false,
      status: 500,
      code: "db_persist_failed",
      message: "Payment session started but workspace records failed. Contact support with the time of this attempt.",
    }
  }

  const url = checkoutUrl
  if (!url) {
    logBlitzpayPreparePayDev("blocked", {
      organizationId,
      invoiceId,
      blockReason: "missing_checkout_url",
      checkoutSessionId: session.id,
    })
    return { ok: false, status: 502, code: "missing_checkout_url", message: "Checkout session creation failed." }
  }

  logBlitzpayPreparePayDev("prepare_pay_success", {
    organizationId,
    invoiceId,
    checkoutUrlPresent: true,
    checkoutSessionId: session.id,
  })

  return {
    ok: true,
    data: {
      url,
      checkoutSessionId: session.id,
      stripePaymentIntentId: stripePiId ?? null,
      blitzpayPaymentIntentRowId,
    },
  }
}
