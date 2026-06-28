import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordEmailBounce } from "@/lib/growth/compliance/compliance-repository"
import { recordEmailComplaint } from "@/lib/growth/compliance/complaint-engine"
import { registerUnsubscribe } from "@/lib/growth/compliance/unsubscribe-engine"
import { logGrowthEngine } from "@/lib/growth/access"
import { updateDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"
import { recordEmailClick, recordEmailOpen } from "@/lib/growth/tracking/tracking-repository"
import { recordDeliveryTimelineFromWebhook } from "@/lib/growth/deliverability/delivery-event-timeline"
import {
  recordProviderBounceReceivedTimelineEvent,
  recordProviderComplaintReceivedTimelineEvent,
  recordProviderDeliveryConfirmedTimelineEvent,
  recordProviderDeliveryFailedTimelineEvent,
  recordProviderEventReceivedTimelineEvent,
  recordProviderUnsubscribeReceivedTimelineEvent,
  recordWebhookSignatureFailedTimelineEvent,
} from "@/lib/growth/webhooks/webhook-events"
import { normalizeProviderWebhookPayload } from "@/lib/growth/webhooks/webhook-normalizer"
import {
  findDeliveryAttemptByProviderMessageId,
  findWebhookEndpointByFamily,
  findWebhookEventByPayloadHash,
  insertProviderDeliveryEvent,
  updateProviderDeliveryEventProcessing,
  updateProviderWebhookEndpoint,
} from "@/lib/growth/webhooks/webhook-repository"
import { hashWebhookPayload, sanitizeProviderWebhookPayload } from "@/lib/growth/webhooks/webhook-sanitizer"
import { verifyProviderWebhookSignature } from "@/lib/growth/webhooks/webhook-signature"
import type { GrowthWebhookIngestResult } from "@/lib/growth/webhooks/webhook-types"
import { shadowLogProviderWebhook } from "@/lib/growth/contact-verification/email-learning-shadow"

function recipientFromAttempt(metadata: Record<string, unknown>, fallback?: string | null): string | null {
  if (fallback) return fallback
  return typeof metadata.to === "string" ? metadata.to : null
}

function maybeShadowLogProviderWebhook(input: {
  email: string | null | undefined
  normalizedEventType: string
  providerFamily: string
  leadId?: string | null
  occurredAt: string
  providerEventId?: string | null
  deliveryAttemptId?: string | null
}): void {
  if (!input.email) return
  shadowLogProviderWebhook({
    email: input.email,
    normalizedEventType: input.normalizedEventType,
    provider: input.providerFamily,
    contactId: input.leadId,
    occurredAt: input.occurredAt,
    providerEventId: input.providerEventId,
    context: { delivery_attempt_id: input.deliveryAttemptId ?? null },
  })
}

async function routeNormalizedWebhookEvent(
  admin: SupabaseClient,
  input: {
    normalizedEventType: ReturnType<typeof normalizeProviderWebhookPayload>["normalizedEventType"]
    deliveryAttemptId: string | null
    leadId: string | null
    providerFamily: string
    providerCode?: string | null
    providerReason?: string | null
    bounceTypeHint?: string | null
    recipientEmail?: string | null
    destinationUrl?: string | null
    payloadHash: string
    occurredAt: string
    attemptMetadata?: Record<string, unknown>
    providerEventId?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const email = recipientFromAttempt(input.attemptMetadata ?? {}, input.recipientEmail)

  await recordProviderEventReceivedTimelineEvent(admin, {
    leadId: input.leadId,
    providerFamily: input.providerFamily,
    normalizedEventType: input.normalizedEventType,
    deliveryAttemptId: input.deliveryAttemptId,
    occurredAt: input.occurredAt,
  })

  if (!input.deliveryAttemptId) {
    return { ok: true }
  }

  switch (input.normalizedEventType) {
    case "delivered": {
      await updateDeliveryAttempt(admin, input.deliveryAttemptId, {
        metadata: {
          ...(input.attemptMetadata ?? {}),
          delivery_confirmed_at: input.occurredAt,
          delivery_confirmed_via: "provider_webhook",
        },
      })
      await recordProviderDeliveryConfirmedTimelineEvent(admin, {
        leadId: input.leadId,
        deliveryAttemptId: input.deliveryAttemptId,
        occurredAt: input.occurredAt,
      })
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "bounced": {
      await recordProviderBounceReceivedTimelineEvent(admin, {
        leadId: input.leadId,
        deliveryAttemptId: input.deliveryAttemptId,
        occurredAt: input.occurredAt,
      })
      await recordEmailBounce(admin, {
        deliveryAttemptId: input.deliveryAttemptId,
        providerCode: input.providerCode,
        providerReason: input.providerReason,
        bounceTypeHint: input.bounceTypeHint,
        recipientEmail: email,
        occurredAt: input.occurredAt,
      })
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "complained": {
      await recordProviderComplaintReceivedTimelineEvent(admin, {
        leadId: input.leadId,
        deliveryAttemptId: input.deliveryAttemptId,
        occurredAt: input.occurredAt,
      })
      await recordEmailComplaint(admin, {
        deliveryAttemptId: input.deliveryAttemptId,
        complaintType: "provider",
        providerReason: input.providerReason,
        recipientEmail: email,
        occurredAt: input.occurredAt,
      })
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "unsubscribed": {
      await recordProviderUnsubscribeReceivedTimelineEvent(admin, {
        leadId: input.leadId,
        deliveryAttemptId: input.deliveryAttemptId,
        occurredAt: input.occurredAt,
      })
      if (email) {
        await registerUnsubscribe(admin, {
          email,
          source: "provider_webhook",
          leadId: input.leadId,
          reason: input.providerReason ?? "Provider unsubscribe webhook",
          occurredAt: input.occurredAt,
        })
      }
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "opened": {
      await recordEmailOpen(admin, {
        deliveryAttemptId: input.deliveryAttemptId,
        openedAt: input.occurredAt,
      })
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "clicked": {
      await recordEmailClick(admin, {
        deliveryAttemptId: input.deliveryAttemptId,
        destinationUrl: input.destinationUrl ?? "https://provider-reported.local/click",
        trackingToken: `provider-webhook:${input.payloadHash.slice(0, 24)}`,
        clickedAt: input.occurredAt,
      })
      maybeShadowLogProviderWebhook({
        email,
        normalizedEventType: input.normalizedEventType,
        providerFamily: input.providerFamily,
        leadId: input.leadId,
        occurredAt: input.occurredAt,
        providerEventId: input.providerEventId,
        deliveryAttemptId: input.deliveryAttemptId,
      })
      return { ok: true }
    }
    case "failed":
    case "dropped": {
      await updateDeliveryAttempt(admin, input.deliveryAttemptId, {
        status: "failed",
        failed_at: input.occurredAt,
        failure_reason: input.providerReason?.slice(0, 500) ?? `${input.normalizedEventType} via provider webhook`,
      })
      await recordProviderDeliveryFailedTimelineEvent(admin, {
        leadId: input.leadId,
        deliveryAttemptId: input.deliveryAttemptId,
        reason: input.providerReason,
        occurredAt: input.occurredAt,
      })
      return { ok: true }
    }
    case "deferred":
    case "unknown":
    default:
      return { ok: true }
  }
}

export async function ingestProviderWebhook(
  admin: SupabaseClient,
  input: {
    providerFamily: string
    rawBody: string
    payload: Record<string, unknown>
    headers: Headers
    querySecret?: string | null
  },
): Promise<GrowthWebhookIngestResult> {
  const endpoint = await findWebhookEndpointByFamily(admin, input.providerFamily)
  const now = new Date().toISOString()

  const sanitizedPayload = sanitizeProviderWebhookPayload(input.payload)
  const payloadHash = hashWebhookPayload({
    providerFamily: input.providerFamily,
    rawBody: input.rawBody,
    sanitizedPayload,
  })

  const existing = await findWebhookEventByPayloadHash(admin, payloadHash)
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      eventId: existing.id,
      normalizedEventType: existing.normalizedEventType,
      processingStatus: "duplicate",
    }
  }

  const signature = verifyProviderWebhookSignature({
    providerFamily: input.providerFamily,
    rawBody: input.rawBody,
    headers: input.headers,
    signingSecretHash: endpoint?.signingSecretHash,
    endpointStatus: endpoint?.status,
    querySecret: input.querySecret,
  })

  const normalized = normalizeProviderWebhookPayload(input.providerFamily, input.payload)
  const occurredAt = normalized.occurredAt ?? now

  if (!signature.ok) {
    const event = await insertProviderDeliveryEvent(admin, {
      providerFamily: input.providerFamily,
      eventType: normalized.eventType,
      normalizedEventType: normalized.normalizedEventType,
      eventStatus: "signature_failed",
      providerMessageId: normalized.providerMessageId,
      occurredAt,
      payloadHash,
      sanitizedPayload,
      processingStatus: "signature_failed",
      processingError: signature.message ?? "Signature verification failed.",
      processedAt: now,
    })

    if (endpoint) {
      await updateProviderWebhookEndpoint(admin, endpoint.id, {
        lastReceivedAt: now,
        incrementFailure: true,
      })
    }

    logGrowthEngine("provider_webhook_signature_failed", {
      providerFamily: input.providerFamily,
      eventId: event.id,
    })

    return {
      ok: false,
      signatureFailed: true,
      eventId: event.id,
      normalizedEventType: normalized.normalizedEventType,
      processingStatus: "signature_failed",
      message: signature.message,
    }
  }

  let attempt: Awaited<ReturnType<typeof findDeliveryAttemptByProviderMessageId>> = null
  if (normalized.providerMessageId) {
    attempt = await findDeliveryAttemptByProviderMessageId(admin, normalized.providerMessageId)
  }

  const event = await insertProviderDeliveryEvent(admin, {
    providerId: attempt?.provider_id ?? null,
    providerFamily: input.providerFamily,
    deliveryAttemptId: attempt?.id ?? null,
    providerMessageId: normalized.providerMessageId ?? null,
    eventType: normalized.eventType,
    normalizedEventType: normalized.normalizedEventType,
    eventStatus: normalized.eventStatus,
    leadId: attempt?.lead_id ?? null,
    senderAccountId: attempt?.sender_account_id ?? null,
    occurredAt,
    payloadHash,
    sanitizedPayload,
    processingStatus: "pending",
  })

  if (endpoint) {
    await updateProviderWebhookEndpoint(admin, endpoint.id, {
      lastReceivedAt: now,
    })
  }

  try {
    const routed = await routeNormalizedWebhookEvent(admin, {
      normalizedEventType: normalized.normalizedEventType,
      deliveryAttemptId: attempt?.id ?? null,
      leadId: attempt?.lead_id ?? null,
      providerFamily: input.providerFamily,
      providerCode: normalized.providerCode,
      providerReason: normalized.providerReason,
      bounceTypeHint: normalized.bounceTypeHint,
      recipientEmail: normalized.recipientEmail,
      destinationUrl: normalized.destinationUrl,
      payloadHash,
      occurredAt,
      attemptMetadata: attempt?.metadata,
      providerEventId: event.id,
    })

    await updateProviderDeliveryEventProcessing(admin, event.id, {
      processingStatus: routed.ok ? "processed" : "failed",
      processingError: routed.error ?? null,
      deliveryAttemptId: attempt?.id ?? null,
      leadId: attempt?.lead_id ?? null,
      senderAccountId: attempt?.sender_account_id ?? null,
      providerId: attempt?.provider_id ?? null,
    })

    await recordDeliveryTimelineFromWebhook(admin, {
      providerFamily: input.providerFamily,
      normalizedEventType: normalized.normalizedEventType,
      providerEventId: event.id,
      providerDeliveryEventId: event.id,
      deliveryAttemptId: attempt?.id ?? null,
      senderAccountId: attempt?.sender_account_id ?? null,
      occurredAt,
      sanitizedPayload,
    }).catch(() => undefined)

    if (endpoint) {
      await updateProviderWebhookEndpoint(admin, endpoint.id, {
        lastSuccessAt: now,
      })
    }

    return {
      ok: routed.ok,
      eventId: event.id,
      normalizedEventType: normalized.normalizedEventType,
      processingStatus: routed.ok ? "processed" : "failed",
      message: routed.error,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await updateProviderDeliveryEventProcessing(admin, event.id, {
      processingStatus: "failed",
      processingError: message.slice(0, 500),
    })
    if (endpoint) {
      await updateProviderWebhookEndpoint(admin, endpoint.id, { incrementFailure: true })
    }
    logGrowthEngine("provider_webhook_processing_failed", {
      providerFamily: input.providerFamily,
      eventId: event.id,
      message,
    })
    return {
      ok: false,
      eventId: event.id,
      normalizedEventType: normalized.normalizedEventType,
      processingStatus: "failed",
      message,
    }
  }
}
