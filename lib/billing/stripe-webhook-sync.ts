import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForPersistence } from "@/lib/billing/plan-id"
import {
  getPlanFromStripePriceId,
  resolvePlanAndBillingCycleFromStripePriceId,
} from "@/lib/billing/stripe-price-map"
import { getOrganizationSubscription, normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function unixSecondsToIso(sec: number | null | undefined): string | null {
  if (sec == null || typeof sec !== "number" || Number.isNaN(sec)) return null
  return new Date(sec * 1000).toISOString()
}

/** Maps Stripe subscription.status to organization_subscriptions.status (CHECK constraint). */
export function mapStripeSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return stripeStatus
    default:
      return "active"
  }
}

/** API response fields not always present on generated `Subscription` type for this API version. */
type SubscriptionApi = Stripe.Subscription & {
  current_period_start: number
  current_period_end: number
}

function primaryPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0]
  if (!item?.price) return null
  const p = item.price
  const raw = typeof p === "string" ? p : p.id
  return normalizeStripeIdColumn(raw)
}

function parseCustomerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (c == null) return null
  if (typeof c === "string") return normalizeStripeIdColumn(c)
  if ("deleted" in c && c.deleted) return null
  return normalizeStripeIdColumn(c.id)
}

export function isValidOrganizationUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

function isValidBillingCycle(value: string | null | undefined): value is "monthly" | "annual" {
  return value === "monthly" || value === "annual"
}

type OrgSubPatch = Record<string, string | boolean | null>

export function buildPatchFromStripeSubscription(
  sub: Stripe.Subscription,
  opts?: { planId?: string | null; billingCycle?: "monthly" | "annual" | null },
): OrgSubPatch {
  const md = sub.metadata ?? {}
  const rawPlanFromMeta = typeof md.plan_id === "string" ? md.plan_id : null
  const cycleFromMeta = typeof md.billing_cycle === "string" ? md.billing_cycle : null

  const hasSub = !!normalizeStripeIdColumn(sub.id)
  const priceId = primaryPriceId(sub)
  const fromPrice = resolvePlanAndBillingCycleFromStripePriceId(priceId)

  const fromOpts =
    opts?.planId != null ? normalizePlanIdForPersistence(String(opts.planId), hasSub) : null
  const fromMeta = normalizePlanIdForPersistence(rawPlanFromMeta, hasSub)
  const planId = fromOpts ?? fromMeta ?? fromPrice.planId

  const billingCycle =
    opts?.billingCycle && isValidBillingCycle(opts.billingCycle) ? opts.billingCycle
    : isValidBillingCycle(cycleFromMeta) ? cycleFromMeta
    : fromPrice.billingCycle

  const s = sub as SubscriptionApi
  const patch: OrgSubPatch = {
    stripe_customer_id: parseCustomerId(sub.customer),
    stripe_subscription_id: normalizeStripeIdColumn(sub.id),
    stripe_price_id: priceId,
    status: mapStripeSubscriptionStatus(sub.status),
    trial_starts_at: unixSecondsToIso(sub.trial_start),
    trial_ends_at: unixSecondsToIso(sub.trial_end),
    current_period_start: unixSecondsToIso(s.current_period_start),
    current_period_end: unixSecondsToIso(s.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: unixSecondsToIso(sub.canceled_at),
    updated_at: new Date().toISOString(),
  }

  if (planId) {
    patch.plan_id = planId
  }
  if (billingCycle) patch.billing_cycle = billingCycle

  // Clear onboarding “intended” tier once Stripe shows a paid-like subscription or we know the purchased plan.
  if (hasSub) {
    const paidLike =
      sub.status === "active" ||
      sub.status === "past_due" ||
      sub.status === "unpaid" ||
      sub.status === "paused" ||
      sub.status === "canceled"
    if (planId || paidLike) {
      patch.intended_plan_id = null
    }
  }

  return patch
}

function normalizeOrgSubscriptionPatch(patch: OrgSubPatch): Record<string, string | boolean | null> {
  const clean: Record<string, string | boolean | null> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (k === "stripe_customer_id" || k === "stripe_subscription_id" || k === "stripe_price_id") {
      const s = v === "" || v == null ? null : normalizeStripeIdColumn(String(v))
      clean[k] = s
      continue
    }
    clean[k] = v as string | boolean | null
  }
  return clean
}

/**
 * Update existing row, or insert one row per organization_id if missing (checkout race / first sync).
 * Does not create duplicate rows — unique on organization_id.
 */
export async function upsertOrganizationSubscriptionPatch(
  admin: SupabaseClient,
  organizationId: string,
  patch: OrgSubPatch,
): Promise<{ inserted: boolean }> {
  const existing = await getOrganizationSubscription(admin, organizationId)
  const clean = normalizeOrgSubscriptionPatch(patch)

  if (existing) {
    const { error } = await admin
      .from("organization_subscriptions")
      .update(clean)
      .eq("organization_id", organizationId)
    if (error) throw new Error(error.message)
    return { inserted: false }
  }

  const insertRow: Record<string, unknown> = {
    organization_id: organizationId,
    stripe_customer_id: clean.stripe_customer_id ?? null,
    stripe_subscription_id: clean.stripe_subscription_id ?? null,
    stripe_price_id: clean.stripe_price_id ?? null,
    plan_id:
      typeof clean.plan_id === "string" && String(clean.plan_id).trim() !== ""
        ? clean.plan_id
        : "solo",
    billing_cycle:
      typeof clean.billing_cycle === "string" && (clean.billing_cycle === "monthly" || clean.billing_cycle === "annual")
        ? clean.billing_cycle
        : "monthly",
    status:
      typeof clean.status === "string" && String(clean.status).trim() !== ""
        ? clean.status
        : "active",
    trial_starts_at: clean.trial_starts_at ?? null,
    trial_ends_at: clean.trial_ends_at ?? null,
    current_period_start: clean.current_period_start ?? null,
    current_period_end: clean.current_period_end ?? null,
    cancel_at_period_end: typeof clean.cancel_at_period_end === "boolean" ? clean.cancel_at_period_end : false,
    canceled_at: clean.canceled_at ?? null,
    intended_plan_id: clean.intended_plan_id !== undefined ? clean.intended_plan_id : null,
    payment_failed_at: clean.payment_failed_at ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from("organization_subscriptions").insert(insertRow)
  if (error) throw new Error(error.message)
  return { inserted: true }
}

function resolveOrganizationIdFromStripeSubscription(sub: Stripe.Subscription): string | null {
  const md = sub.metadata ?? {}
  const metaSnake =
    typeof md.organization_id === "string" ? normalizeStripeIdColumn(md.organization_id.trim()) : null
  const metaCamel =
    typeof md.organizationId === "string" ? normalizeStripeIdColumn(md.organizationId.trim()) : null
  if (isValidOrganizationUuid(metaSnake)) return metaSnake
  if (isValidOrganizationUuid(metaCamel)) return metaCamel
  return null
}

async function findOrgSubscriptionBySubscriptionOrCustomer(
  admin: SupabaseClient,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<{ organization_id: string } | null> {
  const subId = normalizeStripeIdColumn(subscriptionId)
  const custId = normalizeStripeIdColumn(customerId)
  if (subId) {
    const { data, error } = await admin
      .from("organization_subscriptions")
      .select("organization_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data?.organization_id) return data as { organization_id: string }
  }
  if (custId) {
    const { data, error } = await admin
      .from("organization_subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", custId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data?.organization_id) return data as { organization_id: string }
  }
  return null
}

export async function updateOrganizationSubscriptionByOrgId(
  admin: SupabaseClient,
  organizationId: string,
  patch: OrgSubPatch,
): Promise<void> {
  const clean = normalizeOrgSubscriptionPatch(patch)
  const { error } = await admin
    .from("organization_subscriptions")
    .update(clean)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message)
}

async function retrieveSubscription(subId: string): Promise<Stripe.Subscription> {
  const id = normalizeStripeIdColumn(subId)
  if (!id) throw new Error("Missing subscription id")
  return stripe.subscriptions.retrieve(id, {
    expand: ["items.data.price"],
  })
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | Stripe.Subscription | null
  }
  const r = inv.subscription
  if (typeof r === "string") return normalizeStripeIdColumn(r)
  if (r && typeof r === "object" && "id" in r) return normalizeStripeIdColumn((r as Stripe.Subscription).id)
  return null
}

function invoiceCustomerId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null
  }
  const c = inv.customer
  if (c == null) return null
  if (typeof c === "string") return normalizeStripeIdColumn(c)
  if (typeof c === "object" && "deleted" in c && c.deleted) return null
  if (typeof c === "object" && "id" in c) return normalizeStripeIdColumn(c.id)
  return null
}

function resolveOrganizationIdFromCheckout(session: Stripe.Checkout.Session): string | null {
  const ref = normalizeStripeIdColumn(session.client_reference_id)
  if (isValidOrganizationUuid(ref)) return ref
  const m = session.metadata ?? {}
  const metaSnake =
    typeof m.organization_id === "string" ? normalizeStripeIdColumn(m.organization_id) : null
  const metaCamel =
    typeof m.organizationId === "string" ? normalizeStripeIdColumn(m.organizationId) : null
  if (isValidOrganizationUuid(metaSnake)) return metaSnake
  if (isValidOrganizationUuid(metaCamel)) return metaCamel
  return null
}

function billingCycleFromCheckoutMetadata(m: Stripe.Metadata): "monthly" | "annual" | null {
  const snake = typeof m.billing_cycle === "string" ? m.billing_cycle.trim().toLowerCase() : ""
  const camel = typeof m.billingCycle === "string" ? m.billingCycle.trim().toLowerCase() : ""
  const raw = snake || camel
  if (raw === "monthly") return "monthly"
  if (raw === "annual" || raw === "yearly") return "annual"
  return null
}

function sessionPlanBilling(session: Stripe.Checkout.Session): {
  planId: PlanId | null
  billingCycle: "monthly" | "annual" | null
} {
  const m = session.metadata ?? {}
  const rawPlan =
    typeof m.plan_id === "string" ? m.plan_id
    : typeof m.planId === "string" ? m.planId
    : null
  const planId = normalizePlanIdForPersistence(rawPlan, true)
  const billingCycle = billingCycleFromCheckoutMetadata(m)
  return { planId, billingCycle }
}

export type WebhookLogPayload = {
  message: string
  /** Whether we resolved a workspace UUID for this event (when applicable). */
  organizationIdFound?: boolean
  organizationId?: string | null
  subscriptionId?: string | null
  customerId?: string | null
  stripePriceId?: string | null
  /** Resolved from Stripe price id → catalog (`lib/plans` / env overrides). */
  mappedPlanId?: string | null
  mappedBillingCycle?: string | null
}

export type WebhookLogFn = (payload: WebhookLogPayload) => void

export async function handleCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  log: WebhookLogFn,
): Promise<void> {
  if (session.mode !== "subscription") return

  const custRef = session.customer
  const sessionCustomerId =
    typeof custRef === "string" ? normalizeStripeIdColumn(custRef)
    : custRef && typeof custRef === "object" && "id" in custRef ? parseCustomerId(custRef as Stripe.Customer)
    : null

  const organizationId = resolveOrganizationIdFromCheckout(session)
  if (!organizationId) {
    log({
      message: "checkout.session.completed missing valid organizationId (metadata.organizationId / client_reference_id)",
      organizationIdFound: false,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
      customerId: sessionCustomerId,
    })
    return
  }

  const subscriptionRef = session.subscription
  const subId =
    typeof subscriptionRef === "string" ? subscriptionRef
    : subscriptionRef && typeof subscriptionRef === "object" && "id" in subscriptionRef ?
      (subscriptionRef as Stripe.Subscription).id
    : null

  const normalizedSubId = normalizeStripeIdColumn(subId)
  if (!normalizedSubId) {
    log({
      message: "checkout.session.completed missing subscription id",
      organizationIdFound: true,
      organizationId,
      customerId: sessionCustomerId,
    })
    return
  }

  const fullSub = await retrieveSubscription(normalizedSubId)
  const priceId = primaryPriceId(fullSub)
  const { planId, billingCycle } = sessionPlanBilling(session)

  const patch = buildPatchFromStripeSubscription(fullSub, {
    planId,
    billingCycle,
  })

  const mapped = getPlanFromStripePriceId(priceId)
  const upsert = await upsertOrganizationSubscriptionPatch(admin, organizationId, patch)
  log({
    message: `checkout.session.completed synced (${upsert.inserted ? "inserted" : "updated"})`,
    organizationIdFound: true,
    organizationId,
    subscriptionId: normalizedSubId,
    customerId: sessionCustomerId ?? parseCustomerId(fullSub.customer),
    stripePriceId: priceId,
    mappedPlanId: mapped?.planId ?? null,
    mappedBillingCycle: mapped?.billingCycle ?? null,
  })
}

export async function handleSubscriptionEvent(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  log: WebhookLogFn,
  eventType: string,
): Promise<void> {
  const fullSub =
    sub.items?.data?.length ?
      sub
    : await retrieveSubscription(sub.id)

  const patch = buildPatchFromStripeSubscription(fullSub)
  if (eventType === "customer.subscription.deleted") {
    patch.status = "canceled"
  }

  const priceId = primaryPriceId(fullSub)
  const mapped = getPlanFromStripePriceId(priceId)

  const subId = normalizeStripeIdColumn(fullSub.id)
  const custId = parseCustomerId(fullSub.customer)

  let organizationId = resolveOrganizationIdFromStripeSubscription(fullSub)
  let resolvedVia: "subscription_metadata" | "database_lookup" | null = organizationId ?
    "subscription_metadata"
  : null

  if (!organizationId) {
    const found = await findOrgSubscriptionBySubscriptionOrCustomer(admin, subId, custId)
    organizationId = found?.organization_id ?? null
    if (organizationId) resolvedVia = "database_lookup"
  }

  if (!organizationId) {
    log({
      message: `${eventType}: organization not found (metadata.organizationId missing, no DB match for subscription/customer)`,
      organizationIdFound: false,
      subscriptionId: subId,
      customerId: custId,
      stripePriceId: priceId,
      mappedPlanId: mapped?.planId ?? null,
      mappedBillingCycle: mapped?.billingCycle ?? null,
    })
    return
  }

  log({
    message: `${eventType}: resolved organizationId (${resolvedVia ?? "unknown"})`,
    organizationIdFound: true,
    organizationId,
    subscriptionId: subId,
    customerId: custId,
    stripePriceId: priceId,
    mappedPlanId: mapped?.planId ?? null,
    mappedBillingCycle: mapped?.billingCycle ?? null,
  })

  await upsertOrganizationSubscriptionPatch(admin, organizationId, patch)
  log({
    message: `${eventType} synced`,
    organizationIdFound: true,
    organizationId,
    subscriptionId: subId,
    customerId: custId,
    stripePriceId: priceId,
    mappedPlanId: mapped?.planId ?? null,
    mappedBillingCycle: mapped?.billingCycle ?? null,
  })
}

export async function handleInvoicePaymentSucceeded(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
  log: WebhookLogFn,
): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice)
  const customerId = invoiceCustomerId(invoice)

  const found = await findOrgSubscriptionBySubscriptionOrCustomer(admin, subscriptionId, customerId)

  if (!found) {
    log({
      message: "invoice.payment_succeeded: org row not found",
      organizationIdFound: false,
      subscriptionId,
      customerId,
    })
    return
  }

  const patch: OrgSubPatch = {
    payment_failed_at: null,
    updated_at: new Date().toISOString(),
  }

  const sid = subscriptionId
  const custNorm = customerId
  let mapped: ReturnType<typeof getPlanFromStripePriceId> = null
  let invoicePriceId: string | null = null
  if (sid) {
    try {
      const fullSub = await retrieveSubscription(sid)
      invoicePriceId = primaryPriceId(fullSub)
      Object.assign(patch, buildPatchFromStripeSubscription(fullSub))
      patch.payment_failed_at = null
      if (fullSub.status === "active") {
        patch.status = "active"
      }
      mapped = getPlanFromStripePriceId(invoicePriceId)
    } catch {
      log({
        message: "invoice.payment_succeeded: subscription retrieve failed; cleared payment_failed_at only",
        organizationIdFound: true,
        organizationId: found.organization_id,
        subscriptionId: sid,
        customerId: custNorm,
      })
    }
  }

  await updateOrganizationSubscriptionByOrgId(admin, found.organization_id, patch)
  log({
    message: "invoice.payment_succeeded synced",
    organizationIdFound: true,
    organizationId: found.organization_id,
    subscriptionId: sid,
    customerId: custNorm,
    stripePriceId: invoicePriceId,
    mappedPlanId: mapped?.planId ?? null,
    mappedBillingCycle: mapped?.billingCycle ?? null,
  })
}

export async function handleInvoicePaymentFailed(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
  log: WebhookLogFn,
): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice)
  const customerId = invoiceCustomerId(invoice)

  const found = await findOrgSubscriptionBySubscriptionOrCustomer(admin, subscriptionId, customerId)

  if (!found) {
    log({
      message: "invoice.payment_failed: org row not found",
      organizationIdFound: false,
      subscriptionId,
      customerId,
    })
    return
  }

  const failedAt = new Date().toISOString()
  const patch: OrgSubPatch = {
    payment_failed_at: failedAt,
    updated_at: failedAt,
  }

  const sid = subscriptionId
  const custNorm = customerId
  let mapped: ReturnType<typeof getPlanFromStripePriceId> = null
  let invoicePriceId: string | null = null
  if (sid) {
    try {
      const fullSub = await retrieveSubscription(sid)
      invoicePriceId = primaryPriceId(fullSub)
      Object.assign(patch, buildPatchFromStripeSubscription(fullSub))
      if (fullSub.status === "past_due" || fullSub.status === "unpaid") {
        patch.status = mapStripeSubscriptionStatus(fullSub.status)
      } else {
        patch.status = "past_due"
      }
      patch.payment_failed_at = failedAt
      mapped = getPlanFromStripePriceId(invoicePriceId)
    } catch {
      patch.status = "past_due"
      log({
        message: "invoice.payment_failed: subscription retrieve failed, forcing past_due",
        organizationIdFound: true,
        organizationId: found.organization_id,
        subscriptionId: sid,
        customerId: custNorm,
      })
    }
  } else {
    patch.status = "past_due"
  }

  await updateOrganizationSubscriptionByOrgId(admin, found.organization_id, patch)
  log({
    message: "invoice.payment_failed synced",
    organizationIdFound: true,
    organizationId: found.organization_id,
    subscriptionId: sid,
    customerId: custNorm,
    stripePriceId: invoicePriceId,
    mappedPlanId: mapped?.planId ?? null,
    mappedBillingCycle: mapped?.billingCycle ?? null,
  })
}

/**
 * Supported Stripe webhook types:
 * - checkout.session.completed (subscription mode)
 * - customer.subscription.created | .updated | .deleted
 * - invoice.payment_succeeded | invoice.payment_failed
 */
export async function dispatchStripeWebhookEvent(
  event: Stripe.Event,
  admin: SupabaseClient,
  log: WebhookLogFn,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(admin, event.data.object as Stripe.Checkout.Session, log)
      return
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionEvent(admin, event.data.object as Stripe.Subscription, log, event.type)
      return
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(admin, event.data.object as Stripe.Invoice, log)
      return
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice, log)
      return
    default:
      log({ message: `unhandled event type: ${event.type}` })
  }
}
