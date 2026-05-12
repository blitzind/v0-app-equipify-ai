import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { fetchBlitzpayConnectCustomerDefaultPaymentMethodId } from "@/lib/blitzpay/connect-stripe"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  BLITZPAY_AUTOPAY_LIST_CAP,
  BLITZPAY_BILLING_PROFILE_LIST_CAP,
  BLITZPAY_PAYMENT_METHOD_LIST_CAP,
  BLITZPAY_PHASE_3A_REPORTING_PROFILE_CAP,
  type AutopayEnrollmentSource,
  type AutopayEnrollmentStatus,
  type BillingProfileStatus,
  type PreferredInvoiceDelivery,
  computeAutopayReadinessState,
  computeBillingRiskIndicator,
  computeInvoiceCollectionReadiness,
  formatMaskedPaymentMethodLabel,
  hashStripeReference,
  phase3aReportingRates,
} from "@/lib/blitzpay/blitzpay-billing-profiles"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

export type SafeBillingProfileRow = {
  id: string
  customerId: string
  customerLabel: string | null
  status: BillingProfileStatus
  autopayEnabled: boolean
  autopayMethodType: string | null
  preferredInvoiceDelivery: PreferredInvoiceDelivery
  billingEmail: string | null
  billingPhone: string | null
  defaultPaymentMethodLabel: string | null
  collectionReadiness: ReturnType<typeof computeInvoiceCollectionReadiness>
  autopayReadiness: ReturnType<typeof computeAutopayReadinessState>
  billingRisk: ReturnType<typeof computeBillingRiskIndicator>
}

export type SafePaymentMethodRow = {
  id: string
  customerId: string
  billingProfileId: string | null
  paymentMethodType: string
  displayLabel: string
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
  status: string
}

export type SafeAutopayEnrollmentRow = {
  id: string
  customerId: string
  billingProfileId: string
  enrollmentStatus: AutopayEnrollmentStatus
  enrollmentSource: AutopayEnrollmentSource
  paymentTiming: string
  scheduledDay: number | null
  maxChargeAmountCents: number | null
  failureRetryEnabled: boolean
  failureRetryCount: number
  lastSuccessfulChargeAt: string | null
  lastFailedChargeAt: string | null
}

function mapStripePmType(pm: Stripe.PaymentMethod): "card" | "bank_account" | "wallet" | "other" {
  if (pm.type === "card") return "card"
  if (pm.type === "us_bank_account") return "bank_account"
  if (pm.type === "link") return "wallet"
  return "other"
}

function cardBrand(pm: Stripe.PaymentMethod): string | null {
  if (pm.type !== "card" || !pm.card) return null
  return pm.card.display_brand || pm.card.brand || null
}

function cardLast4(pm: Stripe.PaymentMethod): string | null {
  if (pm.type !== "card" || !pm.card) return null
  return pm.card.last4 ?? null
}

function bankLast4(pm: Stripe.PaymentMethod): string | null {
  if (pm.type !== "us_bank_account" || !pm.us_bank_account) return null
  return pm.us_bank_account.last4 ?? null
}

function bankBrand(pm: Stripe.PaymentMethod): string | null {
  if (pm.type !== "us_bank_account") return null
  return "Bank account"
}

export async function fetchBlitzpayPhase3aReportingRates(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data: profiles, error: pErr } = await admin
    .from("blitzpay_customer_billing_profiles")
    .select("id, customer_id, status, autopay_enabled")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_PHASE_3A_REPORTING_PROFILE_CAP)
  if (pErr) throw new Error(pErr.message)
  const plist = (profiles ?? []) as Array<{ id: string; customer_id: string; status: string; autopay_enabled: boolean }>
  const profileIds = plist.map((p) => p.id)
  const customerIds = [...new Set(plist.map((p) => p.customer_id))]

  let enrollRows: Array<{ billing_profile_id: string; enrollment_status: string }> = []
  if (profileIds.length) {
    const { data: e, error: eErr } = await admin
      .from("blitzpay_autopay_enrollments")
      .select("billing_profile_id, enrollment_status")
      .eq("organization_id", organizationId)
      .in("billing_profile_id", profileIds)
      .limit(600)
    if (!eErr && e) enrollRows = e as typeof enrollRows
  }

  const activeEnrollmentByProfile = new Set(
    enrollRows.filter((r) => r.enrollment_status === "active").map((r) => r.billing_profile_id),
  )

  let pmCustomers = new Set<string>()
  if (customerIds.length) {
    const { data: pm, error: pmErr } = await admin
      .from("blitzpay_customer_payment_methods")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .in("customer_id", customerIds.slice(0, 500))
      .limit(800)
    if (!pmErr && pm) {
      for (const r of pm as Array<{ customer_id: string }>) pmCustomers.add(r.customer_id)
    }
  }

  let delinquent = 0
  let billingReady = 0
  let withAutopay = 0
  let withPm = 0
  for (const p of plist) {
    if (p.status === "delinquent") delinquent += 1
    const hasPm = pmCustomers.has(p.customer_id)
    const enrollActive = activeEnrollmentByProfile.has(p.id)
    if (enrollActive) withAutopay += 1
    if (hasPm) withPm += 1
    const readiness = computeAutopayReadinessState({
      profileStatus: p.status as BillingProfileStatus,
      autopayEnabled: p.autopay_enabled,
      enrollmentStatus: enrollRows.find((e) => e.billing_profile_id === p.id)?.enrollment_status as AutopayEnrollmentStatus | null ?? null,
      hasActivePaymentMethod: hasPm,
    })
    const coll = computeInvoiceCollectionReadiness({
      profileStatus: p.status as BillingProfileStatus,
      preferredDelivery: "email",
      hasActivePaymentMethod: hasPm,
      autopayReadiness: readiness,
    })
    if (coll === "ready" || coll === "partial") billingReady += 1
  }

  return phase3aReportingRates({
    profileCount: plist.length,
    profilesWithActiveAutopayEnrollment: withAutopay,
    profilesWithSavedMethod: withPm,
    profilesBillingReady: billingReady,
    delinquentProfileCount: delinquent,
  })
}

async function loadCustomerLabels(
  admin: SupabaseClient,
  organizationId: string,
  customerIds: string[],
): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  if (!customerIds.length) return m
  const { data, error } = await admin
    .from("customers")
    .select("id, company")
    .eq("organization_id", organizationId)
    .in("id", customerIds.slice(0, 200))
  if (error) return m
  for (const r of data ?? []) {
    const row = r as { id: string; company: string | null }
    m.set(row.id, (row.company || "").trim() || "Customer")
  }
  return m
}

export async function listBillingProfilesSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { customerId?: string | null },
): Promise<SafeBillingProfileRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_customer_billing_profiles")
    .select(
      "id, customer_id, status, autopay_enabled, autopay_method_type, preferred_invoice_delivery, billing_email, billing_phone, default_payment_method_last4, default_payment_method_brand, default_payment_method_type",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_BILLING_PROFILE_LIST_CAP)
  if (options?.customerId) {
    assertUuid(options.customerId, "customerId")
    q = q.eq("customer_id", options.customerId)
  }
  const { data: profiles, error } = await q
  if (error) throw new Error(error.message)
  const rows = (profiles ?? []) as Array<{
    id: string
    customer_id: string
    status: string
    autopay_enabled: boolean
    autopay_method_type: string | null
    preferred_invoice_delivery: string
    billing_email: string | null
    billing_phone: string | null
    default_payment_method_last4: string | null
    default_payment_method_brand: string | null
    default_payment_method_type: string | null
  }>
  const custIds = [...new Set(rows.map((r) => r.customer_id))]
  const labels = await loadCustomerLabels(admin, organizationId, custIds)
  const profileIds = rows.map((r) => r.id)

  let enrollByProfile = new Map<string, AutopayEnrollmentStatus>()
  if (profileIds.length) {
    const { data: en } = await admin
      .from("blitzpay_autopay_enrollments")
      .select("billing_profile_id, enrollment_status")
      .eq("organization_id", organizationId)
      .in("billing_profile_id", profileIds)
      .limit(BLITZPAY_AUTOPAY_LIST_CAP)
    for (const e of en ?? []) {
      const row = e as { billing_profile_id: string; enrollment_status: string }
      enrollByProfile.set(row.billing_profile_id, row.enrollment_status as AutopayEnrollmentStatus)
    }
  }

  const hasPmByCustomer = new Map<string, boolean>()
  if (custIds.length) {
    const { data: pm } = await admin
      .from("blitzpay_customer_payment_methods")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .in("customer_id", custIds)
      .limit(BLITZPAY_PAYMENT_METHOD_LIST_CAP)
    for (const p of pm ?? []) {
      hasPmByCustomer.set((p as { customer_id: string }).customer_id, true)
    }
  }

  return rows.map((r) => {
    const enrollStatus = enrollByProfile.get(r.id) ?? null
    const hasPm = Boolean(hasPmByCustomer.get(r.customer_id))
    const autopayReadiness = computeAutopayReadinessState({
      profileStatus: r.status as BillingProfileStatus,
      autopayEnabled: r.autopay_enabled,
      enrollmentStatus: enrollStatus,
      hasActivePaymentMethod: hasPm,
    })
    const defaultLabel =
      r.default_payment_method_last4 && r.default_payment_method_brand ?
        formatMaskedPaymentMethodLabel({
          paymentMethodType: r.default_payment_method_type || "card",
          displayBrand: r.default_payment_method_brand,
          displayLast4: r.default_payment_method_last4,
        })
      : null
    return {
      id: r.id,
      customerId: r.customer_id,
      customerLabel: labels.get(r.customer_id) ?? null,
      status: r.status as BillingProfileStatus,
      autopayEnabled: r.autopay_enabled,
      autopayMethodType: r.autopay_method_type,
      preferredInvoiceDelivery: r.preferred_invoice_delivery as PreferredInvoiceDelivery,
      billingEmail: r.billing_email,
      billingPhone: r.billing_phone,
      defaultPaymentMethodLabel: defaultLabel,
      collectionReadiness: computeInvoiceCollectionReadiness({
        profileStatus: r.status as BillingProfileStatus,
        preferredDelivery: r.preferred_invoice_delivery as PreferredInvoiceDelivery,
        hasActivePaymentMethod: hasPm,
        autopayReadiness,
      }),
      autopayReadiness,
      billingRisk: computeBillingRiskIndicator(r.status as BillingProfileStatus),
    }
  })
}

export async function createBillingProfile(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    createdBy?: string | null
    preferredInvoiceDelivery?: PreferredInvoiceDelivery
    billingEmail?: string | null
    billingPhone?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  const { data: stripeProf, error: spErr } = await admin
    .from("blitzpay_customer_payment_profiles")
    .select("stripe_customer_id")
    .eq("organization_id", input.organizationId)
    .eq("customer_id", input.customerId)
    .maybeSingle()
  if (spErr) throw new Error(spErr.message)
  const stripeCustomerId = (stripeProf as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null
  const stripeCustomerHash = stripeCustomerId ? hashStripeReference(stripeCustomerId) : null

  const now = new Date().toISOString()
  const row = {
    organization_id: input.organizationId,
    customer_id: input.customerId,
    status: "active" as const,
    autopay_enabled: false,
    preferred_invoice_delivery: input.preferredInvoiceDelivery ?? "email",
    billing_email: input.billingEmail ?? null,
    billing_phone: input.billingPhone ?? null,
    stripe_customer_reference_hash: stripeCustomerHash,
    created_by: input.createdBy ?? null,
    metadata: {},
    updated_at: now,
  }
  const { data, error } = await admin
    .from("blitzpay_customer_billing_profiles")
    .upsert(row, { onConflict: "organization_id,customer_id" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id

  const { data: existingEn } = await admin
    .from("blitzpay_autopay_enrollments")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("billing_profile_id", id)
    .maybeSingle()
  if (!existingEn) {
    await admin.from("blitzpay_autopay_enrollments").insert({
      organization_id: input.organizationId,
      customer_id: input.customerId,
      billing_profile_id: id,
      enrollment_status: "paused",
      enrollment_source: "admin",
      payment_timing: "invoice_due",
      metadata: {},
    })
  }
  return { id }
}

export async function updateBillingProfile(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
  patch: Partial<{
    status: BillingProfileStatus
    autopayEnabled: boolean
    autopayMethodType: string | null
    preferredInvoiceDelivery: PreferredInvoiceDelivery
    billingEmail: string | null
    billingPhone: string | null
    defaultPaymentMethodLast4: string | null
    defaultPaymentMethodBrand: string | null
    defaultPaymentMethodType: string | null
  }>,
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  assertUuid(profileId, "profileId")
  const row: Record<string, unknown> = {}
  if (patch.status != null) row.status = patch.status
  if (patch.autopayEnabled != null) row.autopay_enabled = patch.autopayEnabled
  if (patch.autopayMethodType !== undefined) row.autopay_method_type = patch.autopayMethodType
  if (patch.preferredInvoiceDelivery != null) row.preferred_invoice_delivery = patch.preferredInvoiceDelivery
  if (patch.billingEmail !== undefined) row.billing_email = patch.billingEmail
  if (patch.billingPhone !== undefined) row.billing_phone = patch.billingPhone
  if (patch.defaultPaymentMethodLast4 !== undefined) row.default_payment_method_last4 = patch.defaultPaymentMethodLast4
  if (patch.defaultPaymentMethodBrand !== undefined) row.default_payment_method_brand = patch.defaultPaymentMethodBrand
  if (patch.defaultPaymentMethodType !== undefined) row.default_payment_method_type = patch.defaultPaymentMethodType
  if (!Object.keys(row).length) return
  row.updated_at = new Date().toISOString()
  const { error } = await admin.from("blitzpay_customer_billing_profiles").update(row).eq("id", profileId).eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
}

export async function listPaymentMethodsSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { customerId?: string | null },
): Promise<SafePaymentMethodRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_customer_payment_methods")
    .select(
      "id, customer_id, billing_profile_id, payment_method_type, display_brand, display_last4, exp_month, exp_year, is_default, status",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_PAYMENT_METHOD_LIST_CAP)
  if (options?.customerId) {
    assertUuid(options.customerId, "customerId")
    q = q.eq("customer_id", options.customerId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      customer_id: string
      billing_profile_id: string | null
      payment_method_type: string
      display_brand: string | null
      display_last4: string | null
      exp_month: number | null
      exp_year: number | null
      is_default: boolean
      status: string
    }
    return {
      id: row.id,
      customerId: row.customer_id,
      billingProfileId: row.billing_profile_id,
      paymentMethodType: row.payment_method_type,
      displayLabel: formatMaskedPaymentMethodLabel({
        paymentMethodType: row.payment_method_type,
        displayBrand: row.display_brand,
        displayLast4: row.display_last4,
      }),
      expMonth: row.exp_month,
      expYear: row.exp_year,
      isDefault: row.is_default,
      status: row.status,
    }
  })
}

export async function syncPaymentMethodsFromStripe(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ synced: number }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(customerId, "customerId")
  const { data: prof, error: pErr } = await admin
    .from("blitzpay_customer_payment_profiles")
    .select("stripe_customer_id, stripe_connect_account_id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle()
  if (pErr) throw new Error(pErr.message)
  const stripeCustomerId = (prof as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
  const connectId = (prof as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id
  if (!stripeCustomerId || !connectId) {
    throw new Error("missing_stripe_customer")
  }

  const { data: billing } = await admin
    .from("blitzpay_customer_billing_profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle()
  let billingProfileId = (billing as { id?: string } | null)?.id ?? null
  if (!billingProfileId) {
    const created = await createBillingProfile(admin, { organizationId, customerId })
    billingProfileId = created.id
  }

  const stripe = getStripe()
  let defaultPmId: string | null = null
  try {
    defaultPmId = await fetchBlitzpayConnectCustomerDefaultPaymentMethodId({
      stripeConnectAccountId: connectId,
      stripeCustomerId,
    })
  } catch (e) {
    logBlitzpayServerFailure("fetchBlitzpayConnectCustomerDefaultPaymentMethodId", e)
    throw new Error("stripe_customer_fetch_failed")
  }

  const collected: Stripe.PaymentMethod[] = []
  for (const typ of ["card", "us_bank_account"] as const) {
    try {
      const list = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: typ }, { stripeAccount: connectId })
      collected.push(...list.data)
    } catch (e) {
      logBlitzpayServerFailure(`stripe.paymentMethods.list ${typ}`, e)
    }
  }

  let n = 0
  const now = new Date().toISOString()
  let defaultLast4: string | null = null
  let defaultBrand: string | null = null
  let defaultType: string | null = null

  for (const pm of collected) {
    const h = hashStripeReference(pm.id)
    const pmType = mapStripePmType(pm)
    const brand = pm.type === "card" ? cardBrand(pm) : pm.type === "us_bank_account" ? bankBrand(pm) : pm.type === "link" ? "Wallet" : "Other"
    const last4 = pm.type === "card" ? cardLast4(pm) : pm.type === "us_bank_account" ? bankLast4(pm) : null
    const expM = pm.card?.exp_month ?? null
    const expY = pm.card?.exp_year ?? null
    const isDef = Boolean(defaultPmId && pm.id === defaultPmId)
    if (isDef) {
      defaultLast4 = last4
      defaultBrand = brand
      defaultType = pmType
    }
    const { error: upErr } = await admin.from("blitzpay_customer_payment_methods").upsert(
      {
        organization_id: organizationId,
        customer_id: customerId,
        billing_profile_id: billingProfileId,
        payment_method_type: pmType,
        provider: "stripe",
        provider_reference_hash: h,
        display_brand: brand,
        display_last4: last4,
        exp_month: expM,
        exp_year: expY,
        is_default: isDef,
        status: "active",
        metadata: { synced_at: now },
        updated_at: now,
      },
      { onConflict: "organization_id,provider_reference_hash" },
    )
    if (!upErr) n += 1
  }

  await updateBillingProfile(admin, organizationId, billingProfileId, {
    defaultPaymentMethodLast4: defaultLast4,
    defaultPaymentMethodBrand: defaultBrand,
    defaultPaymentMethodType: defaultType,
  })

  return { synced: n }
}

export async function listAutopayEnrollmentsSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { customerId?: string | null },
): Promise<SafeAutopayEnrollmentRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_autopay_enrollments")
    .select(
      "id, customer_id, billing_profile_id, enrollment_status, enrollment_source, payment_timing, scheduled_day, max_charge_amount_cents, failure_retry_enabled, failure_retry_count, last_successful_charge_at, last_failed_charge_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_AUTOPAY_LIST_CAP)
  if (options?.customerId) {
    assertUuid(options.customerId, "customerId")
    q = q.eq("customer_id", options.customerId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as SafeAutopayEnrollmentRow[]
}

export async function upsertAutopayEnrollment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    billingProfileId: string
    enrollmentStatus: AutopayEnrollmentStatus
    enrollmentSource: AutopayEnrollmentSource
    paymentTiming?: string
  },
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  assertUuid(input.billingProfileId, "billingProfileId")
  const row = {
    organization_id: input.organizationId,
    customer_id: input.customerId,
    billing_profile_id: input.billingProfileId,
    enrollment_status: input.enrollmentStatus,
    enrollment_source: input.enrollmentSource,
    payment_timing: input.paymentTiming ?? "invoice_due",
    metadata: {},
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin
    .from("blitzpay_autopay_enrollments")
    .upsert(row, { onConflict: "organization_id,billing_profile_id" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await admin
    .from("blitzpay_customer_billing_profiles")
    .update({
      autopay_enabled: input.enrollmentStatus === "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.billingProfileId)
    .eq("organization_id", input.organizationId)
  return { id: (data as { id: string }).id }
}

export async function patchAutopayEnrollment(
  admin: SupabaseClient,
  organizationId: string,
  enrollmentId: string,
  patch: Partial<{
    enrollmentStatus: AutopayEnrollmentStatus
    paymentTiming: string
    scheduledDay: number | null
    maxChargeAmountCents: number | null
    failureRetryEnabled: boolean
    notes: string | null
  }>,
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  assertUuid(enrollmentId, "enrollmentId")
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.enrollmentStatus != null) row.enrollment_status = patch.enrollmentStatus
  if (patch.paymentTiming != null) row.payment_timing = patch.paymentTiming
  if (patch.scheduledDay !== undefined) row.scheduled_day = patch.scheduledDay
  if (patch.maxChargeAmountCents !== undefined) row.max_charge_amount_cents = patch.maxChargeAmountCents
  if (patch.failureRetryEnabled != null) row.failure_retry_enabled = patch.failureRetryEnabled
  if (patch.notes !== undefined) row.notes = patch.notes
  const { data: before, error: bErr } = await admin
    .from("blitzpay_autopay_enrollments")
    .select("billing_profile_id")
    .eq("id", enrollmentId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (bErr || !before) throw new Error("enrollment_not_found")
  const billingProfileId = (before as { billing_profile_id: string }).billing_profile_id
  const { error } = await admin.from("blitzpay_autopay_enrollments").update(row).eq("id", enrollmentId).eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
  if (patch.enrollmentStatus != null) {
    await admin
      .from("blitzpay_customer_billing_profiles")
      .update({
        autopay_enabled: patch.enrollmentStatus === "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", billingProfileId)
      .eq("organization_id", organizationId)
  }
}
