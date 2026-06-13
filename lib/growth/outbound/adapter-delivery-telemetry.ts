import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthDeliveryAttempt } from "@/lib/growth/providers/adapters/provider-adapter-types"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import {
  createDeliveryAttempt,
  updateDeliveryAttempt,
} from "@/lib/growth/providers/transport/transport-repository"
import type { GrowthProviderFailureClass } from "@/lib/growth/outbound/outbound-reliability-types"
import { classifyProviderFailure } from "@/lib/growth/outbound/provider-failure-classifier"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"


export async function isGrowthOutboundReliabilityH2SchemaReady(admin: SupabaseClient): Promise<boolean> {
  const [{ error: attemptError }, { error: queueError }] = await Promise.all([
    admin.schema("growth").from("delivery_attempts").select("send_plane").limit(1),
    admin.schema("growth").from("outreach_queue").select("retry_count").limit(1),
  ])
  return !attemptError && !queueError
}

async function resolveAdapterTelemetryRouting(
  admin: SupabaseClient,
  providerConnectionId: string,
): Promise<{ providerId: string | null; senderAccountId: string | null }> {
  const sender = await resolveSequenceExecutionSender(admin).catch(() => null)
  if (sender?.providerId && sender.senderAccountId) {
    return { providerId: sender.providerId, senderAccountId: sender.senderAccountId }
  }

  const routes = await listDeliveryRoutes(admin)
  const route = routes.find((row) => row.enabled)
  if (route) {
    return {
      providerId: route.provider_id,
      senderAccountId: sender?.senderAccountId ?? route.sender_account_id,
    }
  }

  return {
    providerId: null,
    senderAccountId: sender?.senderAccountId ?? null,
  }
}

export async function beginAdapterDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    providerConnectionId: string
    leadId: string
    outreachQueueId: string
    toEmail: string
    subject: string
    providerFamily: string
  },
): Promise<GrowthDeliveryAttempt | null> {
  const ready = await isGrowthOutboundReliabilityH2SchemaReady(admin)
  if (!ready) return null

  const routing = await resolveAdapterTelemetryRouting(admin, input.providerConnectionId)
  if (!routing.providerId && !input.providerConnectionId) return null

  const startedAt = Date.now()
  const attempt = await createDeliveryAttempt(admin, {
    provider_id: routing.providerId,
    sender_account_id: routing.senderAccountId,
    lead_id: input.leadId,
    metadata: {
      send_plane: "adapter",
      provider_connection_id: input.providerConnectionId,
      outreach_queue_id: input.outreachQueueId,
      provider_family: input.providerFamily,
      to: input.toEmail,
      subject: input.subject,
      telemetry_started_at: new Date(startedAt).toISOString(),
    },
  })

  return { ...attempt, metadata: { ...attempt.metadata, send_plane: "adapter" } }
}

export async function completeAdapterDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    attemptId: string
    providerMessageId?: string | null
    startedAtMs: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const latencyMs = Math.max(0, Date.now() - input.startedAtMs)
  await updateDeliveryAttempt(admin, input.attemptId, {
    status: "sent",
    sent_at: new Date().toISOString(),
    provider_message_id: input.providerMessageId ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      latency_ms: latencyMs,
      send_plane: "adapter",
    },
  }).catch(() => undefined)

  await admin
    .schema("growth")
    .from("delivery_attempts")
    .update({ latency_ms: latencyMs, failure_class: null })
    .eq("id", input.attemptId)
    .then(() => undefined)
    .catch(() => undefined)
}

export async function failAdapterDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    attemptId: string
    reason: string
    code?: string | null
    blockCode?: string | null
    startedAtMs: number
    metadata?: Record<string, unknown>
  },
): Promise<GrowthProviderFailureClass> {
  const classification = classifyProviderFailure({
    message: input.reason,
    code: input.code,
    blockCode: input.blockCode,
  })
  const latencyMs = Math.max(0, Date.now() - input.startedAtMs)

  await updateDeliveryAttempt(admin, input.attemptId, {
    status: "failed",
    failed_at: new Date().toISOString(),
    failure_reason: input.reason.slice(0, 500),
    metadata: {
      ...(input.metadata ?? {}),
      failure_class: classification.failure_class,
      latency_ms: latencyMs,
      send_plane: "adapter",
    },
  }).catch(() => undefined)

  await admin
    .schema("growth")
    .from("delivery_attempts")
    .update({
      failure_class: classification.failure_class,
      latency_ms: latencyMs,
    })
    .eq("id", input.attemptId)
    .then(() => undefined)
    .catch(() => undefined)

  return classification.failure_class
}
