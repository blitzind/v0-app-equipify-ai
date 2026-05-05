import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForPersistence } from "@/lib/billing/plan-id"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

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
  const fromOpts =
    opts?.planId != null ? normalizePlanIdForPersistence(String(opts.planId), hasSub) : null
  const fromMeta = normalizePlanIdForPersistence(rawPlanFromMeta, hasSub)
  const planId = fromOpts ?? fromMeta

  const billingCycle =
    opts?.billingCycle && isValidBillingCycle(opts.billingCycle) ? opts.billingCycle
    : isValidBillingCycle(cycleFromMeta) ? cycleFromMeta
    : null

  const s = sub as SubscriptionApi
  const patch: OrgSubPatch = {
    stripe_customer_id: parseCustomerId(sub.customer),
    stripe_subscription_id: normalizeStripeIdColumn(sub.id),
    stripe_price_id: primaryPriceId(sub),
    status: mapStripeSubscriptionStatus(sub.status),
    trial_starts_at: unixSecondsToIso(sub.trial_start),
    trial_ends_at: unixSecondsToIso(sub.trial_end),
    current_period_start: unixSecondsToIso(s.current_period_start),
    current_period_end: unixSecondsToIso(s.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: unixSecondsToIso(sub.canceled_at),
    updated_at: new Date().toISOString(),
  }

  if (planId) patch.plan_id = planId
  if (billingCycle) patch.billing_cycle = billingCycle

  return patch
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
  const metaOrg = session.metadata && typeof session.metadata.organization_id === "string"
    ? normalizeStripeIdColumn(session.metadata.organization_id)
    : null
  if (isValidOrganizationUuid(metaOrg)) return metaOrg
  return null
}

function sessionPlanBilling(session: Stripe.Checkout.Session): {
  planId: PlanId | null
  billingCycle: "monthly" | "annual" | null
} {
  const m = session.metadata ?? {}
  const rawPlan = typeof m.plan_id === "string" ? m.plan_id : null
  const planId = normalizePlanIdForPersistence(rawPlan, true)
  const billingCycle =
    typeof m.billing_cycle === "string" && isValidBillingCycle(m.billing_cycle) ? m.billing_cycle
    : null
  return { planId, billingCycle }
}

export type WebhookLogPayload = {
  message: string
  organizationId?: string | null
  subscriptionId?: string | null
  customerId?: string | null
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
      message: "checkout.session.completed missing valid organization_id",
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
      organizationId,
      customerId: sessionCustomerId,
    })
    return
  }

  const fullSub = await retrieveSubscription(normalizedSubId)
  const { planId, billingCycle } = sessionPlanBilling(session)

  const patch = buildPatchFromStripeSubscription(fullSub, {
    planId,
    billingCycle,
  })

  await updateOrganizationSubscriptionByOrgId(admin, organizationId, patch)
  log({
    message: "checkout.session.completed synced",
    organizationId,
    subscriptionId: normalizedSubId,
    customerId: sessionCustomerId ?? parseCustomerId(fullSub.customer),
  })
}

export async function handleSubscriptionEvent(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  log: WebhookLogFn,
): Promise<void> {
  const fullSub =
    sub.items?.data?.length ?
      sub
    : await retrieveSubscription(sub.id)

  const patch = buildPatchFromStripeSubscription(fullSub)

  const subId = normalizeStripeIdColumn(fullSub.id)
  const custId = parseCustomerId(fullSub.customer)

  const found = await findOrgSubscriptionBySubscriptionOrCustomer(admin, subId, custId)
  if (!found) {
    log({
      message: "subscription event: no organization_subscriptions row",
      subscriptionId: subId,
      customerId: custId,
    })
    return
  }

  await updateOrganizationSubscriptionByOrgId(admin, found.organization_id, patch)
  log({
    message: "subscription event synced",
    organizationId: found.organization_id,
    subscriptionId: subId,
    customerId: custId,
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
  if (sid) {
    try {
      const fullSub = await retrieveSubscription(sid)
      Object.assign(patch, buildPatchFromStripeSubscription(fullSub))
      patch.payment_failed_at = null
    } catch {
      log({
        message: "invoice.payment_succeeded: subscription retrieve failed; cleared payment_failed_at only",
        organizationId: found.organization_id,
        subscriptionId: sid,
        customerId: custNorm,
      })
    }
  }

  await updateOrganizationSubscriptionByOrgId(admin, found.organization_id, patch)
  log({
    message: "invoice.payment_succeeded synced",
    organizationId: found.organization_id,
    subscriptionId: sid,
    customerId: custNorm,
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
  if (sid) {
    try {
      const fullSub = await retrieveSubscription(sid)
      Object.assign(patch, buildPatchFromStripeSubscription(fullSub))
      if (fullSub.status === "past_due" || fullSub.status === "unpaid") {
        patch.status = mapStripeSubscriptionStatus(fullSub.status)
      } else {
        patch.status = "past_due"
      }
      patch.payment_failed_at = failedAt
    } catch {
      patch.status = "past_due"
      log({
        message: "invoice.payment_failed: subscription retrieve failed, forcing past_due",
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
    organizationId: found.organization_id,
    subscriptionId: sid,
    customerId: custNorm,
  })
}

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
      await handleSubscriptionEvent(admin, event.data.object as Stripe.Subscription, log)
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
