import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { assertNonNegativeCents, assertPositiveCents } from "@/lib/blitzpay/money"
import type {
  BlitzpayInvoicePayChannel,
  BlitzpayInvoicePaymentAttemptStatus,
  BlitzpayLedgerEntryType,
  BlitzpayPaymentMethodType,
} from "@/lib/blitzpay/payment-domain"
import { computeBlitzpayApplicationFeeBreakdown, type BlitzpayFeeInputs } from "@/lib/blitzpay/fees"

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505"
}

async function assertInvoiceInOrganization(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("org_invoices")
    .select("id, organization_id")
    .eq("id", orgInvoiceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as { organization_id?: string } | null
  if (!row || row.organization_id !== organizationId) {
    throw new Error("org_invoice_not_in_organization")
  }
}

async function assertQuoteInOrganization(
  admin: SupabaseClient,
  organizationId: string,
  orgQuoteId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("org_quotes")
    .select("id, organization_id")
    .eq("id", orgQuoteId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as { organization_id?: string } | null
  if (!row || row.organization_id !== organizationId) {
    throw new Error("org_quote_not_in_organization")
  }
}

async function assertCustomerInOrganization(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("customers")
    .select("id, organization_id")
    .eq("id", customerId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as { organization_id?: string } | null
  if (!row || row.organization_id !== organizationId) {
    throw new Error("customer_not_in_organization")
  }
}

export async function ensureBlitzPayOrgSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  const { error } = await admin.from("blitzpay_org_settings").insert({ organization_id: organizationId })
  if (error && !isUniqueViolation(error)) throw new Error(error.message)
}

export async function fetchBlitzpayOrgSettingsRow(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_org_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Record<string, unknown> | null) ?? null
}

export type CreateBlitzpayPaymentIntentInput = {
  /** When set, row uses this UUID (e.g. pre-generated before Stripe Checkout create). */
  id?: string
  organizationId: string
  stripeConnectAccountId: string
  stripePaymentIntentId: string
  stripeCheckoutSessionId?: string | null
  status: string
  amountCents: bigint
  currency: string
  applicationFeeCents?: bigint | null
  convenienceFeeCents?: bigint
  invoiceAmountCents?: bigint | null
  orgInvoiceId?: string | null
  orgQuoteId?: string | null
  customerId?: string | null
  idempotencyKey: string
  metadata?: Record<string, unknown>
  paymentMethodType?: BlitzpayPaymentMethodType | null
  stripePaymentMethodId?: string | null
  stripeCustomerId?: string | null
  savePaymentMethodRequested?: boolean
}

export async function createBlitzpayPaymentIntentRecord(
  admin: SupabaseClient,
  input: CreateBlitzpayPaymentIntentInput,
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertPositiveCents(input.amountCents, "amountCents")
  if (input.orgInvoiceId) {
    assertUuid(input.orgInvoiceId, "orgInvoiceId")
    await assertInvoiceInOrganization(admin, input.organizationId, input.orgInvoiceId)
  }
  if (input.orgQuoteId) {
    assertUuid(input.orgQuoteId, "orgQuoteId")
    await assertQuoteInOrganization(admin, input.organizationId, input.orgQuoteId)
  }
  if (input.customerId) {
    assertUuid(input.customerId, "customerId")
    await assertCustomerInOrganization(admin, input.organizationId, input.customerId)
  }

  if (input.applicationFeeCents != null) {
    assertNonNegativeCents(input.applicationFeeCents, "applicationFeeCents")
  }

  const convenienceFee = input.convenienceFeeCents ?? 0n
  assertNonNegativeCents(convenienceFee, "convenienceFeeCents")
  if (input.invoiceAmountCents != null) {
    assertNonNegativeCents(input.invoiceAmountCents, "invoiceAmountCents")
  }

  const row = {
    organization_id: input.organizationId,
    stripe_connect_account_id: input.stripeConnectAccountId,
    stripe_payment_intent_id: input.stripePaymentIntentId,
    stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
    status: input.status,
    amount_cents: input.amountCents.toString(),
    currency: input.currency.trim().toLowerCase(),
    application_fee_cents:
      input.applicationFeeCents == null ? null : input.applicationFeeCents.toString(),
    convenience_fee_cents: convenienceFee.toString(),
    invoice_amount_cents:
      input.invoiceAmountCents == null ? null : input.invoiceAmountCents.toString(),
    org_invoice_id: input.orgInvoiceId ?? null,
    org_quote_id: input.orgQuoteId ?? null,
    customer_id: input.customerId ?? null,
    idempotency_key: input.idempotencyKey,
    metadata: input.metadata ?? {},
    payment_method_type: input.paymentMethodType ?? null,
    stripe_payment_method_id: input.stripePaymentMethodId ?? null,
    stripe_customer_id: input.stripeCustomerId ?? null,
    save_payment_method_requested: Boolean(input.savePaymentMethodRequested),
  }

  const { data, error } = await admin.from("blitzpay_payment_intents").insert(row).select("id").single()

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: existing, error: selErr } = await admin
        .from("blitzpay_payment_intents")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle()
      if (selErr) throw new Error(selErr.message)
      const id = (existing as { id?: string } | null)?.id
      if (id) return { id }
    }
    throw new Error(error.message)
  }
  return { id: (data as { id: string }).id }
}

export async function nextBlitzpayInvoicePaymentAttemptNo(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<number> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const { data, error } = await admin
    .from("blitzpay_invoice_payment_attempts")
    .select("attempt_no")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .order("attempt_no", { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = (data as { attempt_no?: number }[] | null)?.[0]?.attempt_no ?? 0
  return max + 1
}

export async function nextBlitzpayQuotePaymentAttemptNo(
  admin: SupabaseClient,
  organizationId: string,
  orgQuoteId: string,
): Promise<number> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgQuoteId, "orgQuoteId")
  const { data, error } = await admin
    .from("blitzpay_invoice_payment_attempts")
    .select("attempt_no")
    .eq("organization_id", organizationId)
    .eq("org_quote_id", orgQuoteId)
    .order("attempt_no", { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = (data as { attempt_no?: number }[] | null)?.[0]?.attempt_no ?? 0
  return max + 1
}

export type CreateBlitzpayInvoicePaymentAttemptInput = {
  organizationId: string
  orgInvoiceId?: string | null
  orgQuoteId?: string | null
  blitzpayPaymentIntentId?: string | null
  attemptNo: number
  channel: BlitzpayInvoicePayChannel
  createdByUserId?: string | null
  portalAccessContext?: Record<string, unknown> | null
  status: BlitzpayInvoicePaymentAttemptStatus
  failureCode?: string | null
}

export async function createBlitzpayInvoicePaymentAttempt(
  admin: SupabaseClient,
  input: CreateBlitzpayInvoicePaymentAttemptInput,
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  const hasInv = Boolean(input.orgInvoiceId)
  const hasQuote = Boolean(input.orgQuoteId)
  if (hasInv === hasQuote) {
    throw new Error("Exactly one of orgInvoiceId or orgQuoteId is required for payment attempts.")
  }
  if (input.orgInvoiceId) {
    assertUuid(input.orgInvoiceId, "orgInvoiceId")
    await assertInvoiceInOrganization(admin, input.organizationId, input.orgInvoiceId)
  }
  if (input.orgQuoteId) {
    assertUuid(input.orgQuoteId, "orgQuoteId")
    await assertQuoteInOrganization(admin, input.organizationId, input.orgQuoteId)
  }

  const row = {
    organization_id: input.organizationId,
    org_invoice_id: input.orgInvoiceId ?? null,
    org_quote_id: input.orgQuoteId ?? null,
    blitzpay_payment_intent_id: input.blitzpayPaymentIntentId ?? null,
    attempt_no: input.attemptNo,
    channel: input.channel,
    created_by_user_id: input.createdByUserId ?? null,
    portal_access_context: input.portalAccessContext ?? null,
    status: input.status,
    failure_code: input.failureCode ?? null,
  }

  const { data, error } = await admin
    .from("blitzpay_invoice_payment_attempts")
    .insert(row)
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id }
}

export async function createBlitzpayFeeSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    blitzpayPaymentIntentId: string
    feeInputs: BlitzpayFeeInputs
    stripeFeeEstimateCents?: number | null
  },
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.blitzpayPaymentIntentId, "blitzpayPaymentIntentId")

  const breakdown = computeBlitzpayApplicationFeeBreakdown(input.feeInputs)

  const row = {
    organization_id: input.organizationId,
    blitzpay_payment_intent_id: input.blitzpayPaymentIntentId,
    platform_fee_bps: input.feeInputs.platformFeeBps,
    platform_fee_fixed_cents: input.feeInputs.platformFeeFixedCents,
    convenience_fee_bps: input.feeInputs.convenienceFeeBps ?? 0,
    convenience_fee_fixed_cents: input.feeInputs.convenienceFeeFixedCents ?? 0,
    stripe_fee_estimate_cents: input.stripeFeeEstimateCents ?? null,
    computed_total_application_fee_cents: breakdown.computedTotalApplicationFeeCents.toString(),
    policy_version: breakdown.policyVersion,
  }

  const { data, error } = await admin.from("blitzpay_fee_snapshots").insert(row).select("id").single()

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: existing, error: selErr } = await admin
        .from("blitzpay_fee_snapshots")
        .select("id")
        .eq("blitzpay_payment_intent_id", input.blitzpayPaymentIntentId)
        .maybeSingle()
      if (selErr) throw new Error(selErr.message)
      const id = (existing as { id?: string } | null)?.id
      if (id) return { id }
    }
    throw new Error(error.message)
  }
  return { id: (data as { id: string }).id }
}

export type AppendBlitzpayLedgerEntryInput = {
  organizationId: string
  entryType: BlitzpayLedgerEntryType
  amountCents: bigint
  currency: string
  stripeObjectId?: string | null
  blitzpayPaymentIntentId?: string | null
  orgInvoiceId?: string | null
  orgQuoteId?: string | null
  metadata?: Record<string, unknown>
}

export async function appendBlitzpayLedgerEntry(
  admin: SupabaseClient,
  input: AppendBlitzpayLedgerEntryInput,
): Promise<{ id: string; duplicate: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  if (input.orgInvoiceId) {
    assertUuid(input.orgInvoiceId, "orgInvoiceId")
    await assertInvoiceInOrganization(admin, input.organizationId, input.orgInvoiceId)
  }
  if (input.orgQuoteId) {
    assertUuid(input.orgQuoteId, "orgQuoteId")
    await assertQuoteInOrganization(admin, input.organizationId, input.orgQuoteId)
  }

  const row = {
    organization_id: input.organizationId,
    entry_type: input.entryType,
    amount_cents: input.amountCents.toString(),
    currency: input.currency.trim().toLowerCase(),
    stripe_object_id: input.stripeObjectId ?? null,
    blitzpay_payment_intent_id: input.blitzpayPaymentIntentId ?? null,
    org_invoice_id: input.orgInvoiceId ?? null,
    org_quote_id: input.orgQuoteId ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await admin.from("blitzpay_ledger_entries").insert(row).select("id").single()

  if (error) {
    if (isUniqueViolation(error) && input.stripeObjectId) {
      const { data: existing, error: selErr } = await admin
        .from("blitzpay_ledger_entries")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("entry_type", input.entryType)
        .eq("stripe_object_id", input.stripeObjectId)
        .maybeSingle()
      if (selErr) throw new Error(selErr.message)
      const id = (existing as { id?: string } | null)?.id
      if (id) return { id, duplicate: true }
    }
    throw new Error(error.message)
  }
  return { id: (data as { id: string }).id, duplicate: false }
}

export async function fetchBlitzpayPaymentIntentsForInvoice(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
  limit = 25,
): Promise<unknown[]> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const { data, error } = await admin
    .from("blitzpay_payment_intents")
    .select(
      "id, status, amount_cents, currency, stripe_payment_intent_id, stripe_checkout_session_id, created_at, updated_at, last_stripe_event_at",
    )
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchBlitzpayPaymentIntentByStripeId(
  admin: SupabaseClient,
  stripePaymentIntentId: string,
): Promise<unknown | null> {
  const { data, error } = await admin
    .from("blitzpay_payment_intents")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

export async function updateBlitzpayPaymentIntentMethodDetails(
  admin: SupabaseClient,
  stripePaymentIntentId: string,
  patch: {
    paymentMethodType?: BlitzpayPaymentMethodType | null
    stripePaymentMethodId?: string | null
    stripeCustomerId?: string | null
    achSettlementState?: "pending" | "settled" | "failed" | null
  },
): Promise<void> {
  const row = {
    payment_method_type: patch.paymentMethodType ?? null,
    stripe_payment_method_id: patch.stripePaymentMethodId ?? null,
    stripe_customer_id: patch.stripeCustomerId ?? null,
    ach_settlement_state: patch.achSettlementState ?? null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin
    .from("blitzpay_payment_intents")
    .update(row)
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
  if (error) throw new Error(error.message)
}

export async function updateBlitzpayInvoicePaymentAttemptsForInternalIntent(
  admin: SupabaseClient,
  internalPaymentIntentId: string,
  patch: { status: BlitzpayInvoicePaymentAttemptStatus; failureCode?: string | null },
): Promise<void> {
  assertUuid(internalPaymentIntentId, "internalPaymentIntentId")
  const { error } = await admin
    .from("blitzpay_invoice_payment_attempts")
    .update({
      status: patch.status,
      failure_code: patch.failureCode ?? null,
    })
    .eq("blitzpay_payment_intent_id", internalPaymentIntentId)
  if (error) throw new Error(error.message)
}
