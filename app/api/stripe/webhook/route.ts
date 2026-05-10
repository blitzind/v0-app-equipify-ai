import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  dispatchStripeWebhookEvent,
  type WebhookLogFn,
} from "@/lib/billing/stripe-webhook-sync"
import { stripeWebhookLogContext } from "@/lib/billing/stripe-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

function buildLogger(eventId: string, eventType: string): WebhookLogFn {
  const ctx = stripeWebhookLogContext()
  return (payload) => {
    const line = {
      source: "stripe-webhook" as const,
      eventId,
      eventType,
      stripeLiveEnforced: ctx.stripeLiveEnforced,
      vercelEnv: ctx.vercelEnv ?? null,
      nodeEnv: ctx.nodeEnv ?? null,
      message: payload.message,
      ...(payload.organizationIdFound !== undefined && {
        organizationIdFound: payload.organizationIdFound,
      }),
      ...(payload.organizationId != null && { organizationId: payload.organizationId }),
      ...(payload.subscriptionId != null && { subscriptionId: payload.subscriptionId }),
      ...(payload.customerId != null && { customerId: payload.customerId }),
      ...(payload.stripePriceId != null && { stripePriceId: payload.stripePriceId }),
      ...(payload.mappedPlanId != null && { mappedPlanId: payload.mappedPlanId }),
      ...(payload.mappedBillingCycle != null && { mappedBillingCycle: payload.mappedBillingCycle }),
      ...(payload.stripeSubscriptionStatus != null && {
        stripeSubscriptionStatus: payload.stripeSubscriptionStatus,
      }),
      ...(payload.priceMappingOk !== undefined && { priceMappingOk: payload.priceMappingOk }),
      ...(payload.entitlementsSyncOk !== undefined && { entitlementsSyncOk: payload.entitlementsSyncOk }),
      ...(payload.dispatch != null && { dispatch: payload.dispatch }),
    }
    console.info(JSON.stringify(line))
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        message: "STRIPE_WEBHOOK_SECRET is not configured",
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (e) {
    if (e instanceof Error && e.message.includes("STRIPE_SECRET_KEY")) {
      console.error(
        JSON.stringify({
          source: "stripe-webhook",
          message: e.message,
          phase: "stripe_client_init",
          ...stripeWebhookLogContext(),
        }),
      )
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }
    console.warn(
      JSON.stringify({
        source: "stripe-webhook",
        message: "signature verification failed",
        phase: "construct_event",
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const log = buildLogger(event.id, event.type)
  log({ message: "event verified — dispatching" })

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        message: msg,
        phase: "supabase_service_role",
        eventId: event.id,
        eventType: event.type,
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 })
  }

  const { error: insertError } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
  })

  if (insertError && isUniqueViolation(insertError)) {
    log({ message: "duplicate event id — skipping (already processed)", dispatch: "skipped" })
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (insertError) {
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        message: "idempotency insert failed",
        detail: insertError.message,
        eventId: event.id,
        eventType: event.type,
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 })
  }

  try {
    await dispatchStripeWebhookEvent(event, admin, log)
  } catch (e) {
    await admin.from("stripe_webhook_events").delete().eq("id", event.id)
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "stripe-webhook",
        message: "handler failed — subscription row not committed",
        detail: msg,
        eventId: event.id,
        eventType: event.type,
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
