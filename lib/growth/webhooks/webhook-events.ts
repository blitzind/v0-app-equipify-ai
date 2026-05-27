import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthNormalizedWebhookEventType } from "@/lib/growth/webhooks/webhook-types"

export async function recordProviderEventReceivedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    providerFamily: string
    normalizedEventType: GrowthNormalizedWebhookEventType
    deliveryAttemptId?: string | null
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_event_received",
    title: "Provider event received",
    summary: `${input.providerFamily} reported ${input.normalizedEventType}.`,
    payload: {
      provider_family: input.providerFamily,
      normalized_event_type: input.normalizedEventType,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      source: "growth_webhooks",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordProviderDeliveryConfirmedTimelineEvent(
  admin: SupabaseClient,
  input: { leadId?: string | null; deliveryAttemptId: string; occurredAt?: string },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_delivery_confirmed",
    title: "Delivery confirmed",
    summary: "Provider confirmed message delivery.",
    payload: { delivery_attempt_id: input.deliveryAttemptId, source: "growth_webhooks" },
    occurredAt: input.occurredAt,
  })
}

export async function recordProviderDeliveryFailedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    deliveryAttemptId?: string | null
    reason?: string | null
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_delivery_failed",
    title: "Delivery failed",
    summary: input.reason ?? "Provider reported delivery failure.",
    payload: {
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      source: "growth_webhooks",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordProviderBounceReceivedTimelineEvent(
  admin: SupabaseClient,
  input: { leadId?: string | null; deliveryAttemptId: string; occurredAt?: string },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_bounce_received",
    title: "Provider bounce received",
    summary: "Provider reported a bounce event.",
    payload: { delivery_attempt_id: input.deliveryAttemptId, source: "growth_webhooks" },
    occurredAt: input.occurredAt,
  })
}

export async function recordProviderComplaintReceivedTimelineEvent(
  admin: SupabaseClient,
  input: { leadId?: string | null; deliveryAttemptId: string; occurredAt?: string },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_complaint_received",
    title: "Provider complaint received",
    summary: "Provider reported a spam complaint.",
    payload: { delivery_attempt_id: input.deliveryAttemptId, source: "growth_webhooks" },
    occurredAt: input.occurredAt,
  })
}

export async function recordProviderUnsubscribeReceivedTimelineEvent(
  admin: SupabaseClient,
  input: { leadId?: string | null; deliveryAttemptId?: string | null; occurredAt?: string },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "provider_unsubscribe_received",
    title: "Provider unsubscribe received",
    summary: "Provider reported an unsubscribe event.",
    payload: {
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      source: "growth_webhooks",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordWebhookSignatureFailedTimelineEvent(
  admin: SupabaseClient,
  input: { leadId?: string | null; providerFamily: string; occurredAt?: string },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "webhook_signature_failed",
    title: "Webhook signature failed",
    summary: `${input.providerFamily} webhook rejected — signature verification failed.`,
    payload: { provider_family: input.providerFamily, source: "growth_webhooks" },
    occurredAt: input.occurredAt,
  })
}
