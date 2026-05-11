import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { buildBlitzPayOrgUpdateFromStripeAccount } from "@/lib/blitzpay/connect-stripe"
import { stripeWebhookLogContext } from "@/lib/billing/stripe-env"
import { dispatchBlitzPayPhase2Webhook } from "@/lib/blitzpay/webhook-phase2-dispatch"
import {
  blitzpayWebhookInboxInsertPending,
  blitzpayWebhookInboxMarkDead,
  blitzpayWebhookInboxMarkDone,
  blitzpayWebhookInboxResetDeadToPending,
  truncateInboxError,
} from "@/lib/blitzpay/webhook-inbox"
import {
  blitzpayWebhookPayloadSha256,
  isBlitzPayPhase2WebhookEventType,
} from "@/lib/blitzpay/webhook-phase2-events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

async function handleAccountUpdated(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  event: Stripe.Event,
): Promise<void> {
  const account = event.data.object as Stripe.Account
  const accountId = account.id
  const patch = buildBlitzPayOrgUpdateFromStripeAccount(account)

  const { data: orgs, error: findErr } = await admin
    .from("organizations")
    .select("id")
    .eq("stripe_connect_account_id", accountId)
    .limit(2)

  if (findErr) {
    throw new Error(findErr.message)
  }

  if (!orgs || orgs.length === 0) {
    console.info(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "account.updated: no organization for connected account id",
        eventId: event.id,
        accountId,
        ...stripeWebhookLogContext(),
      }),
    )
  } else if (orgs.length > 1) {
    console.warn(
      JSON.stringify({
        source: "blitzpay-webhook",
        message:
          "account.updated: multiple organizations share stripe_connect_account_id — skipping update",
        eventId: event.id,
        accountId,
        ...stripeWebhookLogContext(),
      }),
    )
  } else {
    const orgId = (orgs[0] as { id: string }).id
    const { error: upErr } = await admin.from("organizations").update(patch).eq("id", orgId)
    if (upErr) {
      throw new Error(upErr.message)
    }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_BLITZPAY_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "STRIPE_BLITZPAY_WEBHOOK_SECRET is not configured",
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
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }
    console.warn(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "signature verification failed",
        phase: "construct_event",
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ source: "blitzpay-webhook", message: msg, ...stripeWebhookLogContext() }))
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 })
  }

  const { error: insertError } = await admin.from("blitzpay_stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
  })

  if (insertError && isUniqueViolation(insertError)) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (insertError) {
    console.error(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "idempotency insert failed",
        detail: insertError.message,
        eventId: event.id,
        eventType: event.type,
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 })
  }

  const phase2 = isBlitzPayPhase2WebhookEventType(event.type)

  try {
    if (event.type === "account.updated") {
      await handleAccountUpdated(admin, event)
    } else if (phase2) {
      const payloadHash = blitzpayWebhookPayloadSha256(rawBody)
      const connectAccount =
        typeof event.account === "string" && event.account.length > 0 ? event.account : null
      const { inserted } = await blitzpayWebhookInboxInsertPending(admin, {
        stripe_event_id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        stripe_connect_account: connectAccount,
        payload_hash: payloadHash,
      })
      if (!inserted) {
        await blitzpayWebhookInboxResetDeadToPending(admin, event.id)
      }
      await dispatchBlitzPayPhase2Webhook(admin, event)
      await blitzpayWebhookInboxMarkDone(admin, event.id)
    } else {
      console.info(
        JSON.stringify({
          source: "blitzpay-webhook",
          message: `ignored event type (${event.type})`,
          eventId: event.id,
          ...stripeWebhookLogContext(),
        }),
      )
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    if (phase2) {
      try {
        await blitzpayWebhookInboxMarkDead(admin, event.id, errMsg)
      } catch (inboxErr) {
        console.error(
          JSON.stringify({
            source: "blitzpay-webhook",
            message: "failed to mark blitzpay_webhook_inbox dead",
            detail: inboxErr instanceof Error ? inboxErr.message : String(inboxErr),
            eventId: event.id,
            ...stripeWebhookLogContext(),
          }),
        )
      }
    }

    await admin.from("blitzpay_stripe_webhook_events").delete().eq("id", event.id)
    console.error(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "handler failed",
        detail: truncateInboxError(errMsg),
        eventId: event.id,
        eventType: event.type,
        ...stripeWebhookLogContext(),
      }),
    )
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
