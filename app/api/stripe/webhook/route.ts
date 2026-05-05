import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  dispatchStripeWebhookEvent,
  type WebhookLogFn,
} from "@/lib/billing/stripe-webhook-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

function buildLogger(eventId: string, eventType: string): WebhookLogFn {
  return (payload) => {
    const line = {
      source: "stripe-webhook" as const,
      eventId,
      eventType,
      message: payload.message,
      ...(payload.organizationId != null && { organizationId: payload.organizationId }),
      ...(payload.subscriptionId != null && { subscriptionId: payload.subscriptionId }),
      ...(payload.customerId != null && { customerId: payload.customerId }),
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
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const log = buildLogger(event.id, event.type)

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[stripe-webhook]", msg)
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 })
  }

  const { error: insertError } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
  })

  if (insertError && isUniqueViolation(insertError)) {
    log({ message: "duplicate event id — skipping (already processed)" })
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (insertError) {
    console.error("[stripe-webhook] idempotency insert failed", insertError.message)
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 })
  }

  try {
    await dispatchStripeWebhookEvent(event, admin, log)
  } catch (e) {
    await admin.from("stripe_webhook_events").delete().eq("id", event.id)
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[stripe-webhook] handler failed", msg)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
