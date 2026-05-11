import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { evaluateBlitzpayAutopayEligibility } from "@/lib/blitzpay/blitzpay-autopay-foundation"

function toMethodType(v: string | null | undefined): BlitzpayPaymentMethodType | null {
  if (v === "card" || v === "us_bank_account") return v
  return null
}

type UpsertProfileInput = {
  organizationId: string
  customerId: string
  stripeConnectAccountId: string
  stripeCustomerId: string | null
  paymentMethodType: BlitzpayPaymentMethodType | null
  hasDefaultPaymentMethod: boolean
  savePaymentMethodOptIn: boolean
  offSessionAuthorized: boolean
  blitzpayPaymentIntentId: string
  metadata?: Record<string, unknown>
}

export async function upsertBlitzpayCustomerPaymentProfile(
  admin: SupabaseClient,
  input: UpsertProfileInput,
): Promise<void> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  assertUuid(input.blitzpayPaymentIntentId, "blitzpayPaymentIntentId")
  const autopay = evaluateBlitzpayAutopayEligibility({
    invoiceBalanceCents: 1,
    hasStoredProfile: true,
    hasDefaultPaymentMethod: input.hasDefaultPaymentMethod,
    offSessionAuthorized: input.offSessionAuthorized,
    defaultPaymentMethodType: input.paymentMethodType,
  })

  const now = new Date().toISOString()
  const row = {
    organization_id: input.organizationId,
    customer_id: input.customerId,
    stripe_connect_account_id: input.stripeConnectAccountId,
    stripe_customer_id: input.stripeCustomerId,
    has_default_payment_method: input.hasDefaultPaymentMethod,
    default_payment_method_type: input.hasDefaultPaymentMethod ? input.paymentMethodType : null,
    last_used_payment_method_type: input.paymentMethodType,
    save_payment_method_opt_in: input.savePaymentMethodOptIn,
    off_session_authorized: input.offSessionAuthorized,
    autopay_eligible: autopay.eligible,
    last_blitzpay_payment_intent_id: input.blitzpayPaymentIntentId,
    last_used_at: now,
    metadata: input.metadata ?? {},
    updated_at: now,
  }

  const { error } = await admin
    .from("blitzpay_customer_payment_profiles")
    .upsert(row, { onConflict: "organization_id,customer_id" })
  if (error) throw new Error(error.message)
}

type BlitzpayPiForProfile = {
  id: string
  organization_id: string
  customer_id: string | null
  stripe_connect_account_id: string
  stripe_customer_id: string | null
  save_payment_method_requested: boolean
  payment_method_type: string | null
}

export async function syncBlitzpayCustomerPaymentProfileFromPaymentIntent(
  admin: SupabaseClient,
  piRow: BlitzpayPiForProfile,
  stripePi: Stripe.PaymentIntent,
): Promise<void> {
  if (!piRow.customer_id) return
  const fromIntent = toMethodType(piRow.payment_method_type)
  const fromStripe = toMethodType(
    typeof stripePi.payment_method === "object" && stripePi.payment_method ?
      (stripePi.payment_method as Stripe.PaymentMethod).type
    : undefined,
  )
  const methodType = fromStripe ?? fromIntent ?? null
  const stripeCustomer =
    typeof stripePi.customer === "string" ? stripePi.customer
    : stripePi.customer && typeof stripePi.customer === "object" ? stripePi.customer.id
    : piRow.stripe_customer_id

  await upsertBlitzpayCustomerPaymentProfile(admin, {
    organizationId: piRow.organization_id,
    customerId: piRow.customer_id,
    stripeConnectAccountId: piRow.stripe_connect_account_id,
    stripeCustomerId: stripeCustomer ?? null,
    paymentMethodType: methodType,
    hasDefaultPaymentMethod: Boolean(stripePi.setup_future_usage === "off_session" && methodType),
    savePaymentMethodOptIn: Boolean(piRow.save_payment_method_requested),
    offSessionAuthorized: Boolean(stripePi.setup_future_usage === "off_session"),
    blitzpayPaymentIntentId: piRow.id,
    metadata: {
      source: "payment_intent_succeeded",
    },
  })
}

export async function fetchBlitzpayStoredPaymentProfilesSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  totalProfiles: number
  withDefaultMethod: number
  lastUsedMethodMix: { card: number; us_bank_account: number; unknown: number }
}> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_customer_payment_profiles")
    .select("has_default_payment_method, last_used_payment_method_type")
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
  let withDefaultMethod = 0
  const mix = { card: 0, us_bank_account: 0, unknown: 0 }
  for (const row of data ?? []) {
    const r = row as { has_default_payment_method?: boolean; last_used_payment_method_type?: string | null }
    if (r.has_default_payment_method) withDefaultMethod += 1
    if (r.last_used_payment_method_type === "card") mix.card += 1
    else if (r.last_used_payment_method_type === "us_bank_account") mix.us_bank_account += 1
    else mix.unknown += 1
  }
  return {
    totalProfiles: (data ?? []).length,
    withDefaultMethod,
    lastUsedMethodMix: mix,
  }
}
