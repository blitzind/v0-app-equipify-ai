import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureGrowthStubOutboundConnection, fetchGrowthOutboundConnectionById } from "@/lib/growth/outbound/connection-repository"
import { processOutboundEvent } from "@/lib/growth/outbound/process-event"
import { getOutboundProviderAdapter } from "@/lib/growth/outbound/providers/registry"
import type { OutboundFixtureEnvelope, ProcessOutboundEventResult } from "@/lib/growth/outbound/types"
import {
  extractEmailFromWebhookPayload,
  fetchGrowthProviderWebhookById,
  insertGrowthProviderWebhook,
  updateGrowthProviderWebhook,
} from "@/lib/growth/outbound/webhook-repository"

export async function ingestOutboundWebhookPayload(
  admin: SupabaseClient,
  input: {
    provider: string
    headers?: Record<string, unknown>
    payload: unknown
    connectionId?: string
    actorUserId?: string | null
  },
): Promise<{ webhookId: string; results: ProcessOutboundEventResult[] }> {
  const adapter = getOutboundProviderAdapter(input.provider)
  const connection = input.connectionId
    ? (await fetchGrowthOutboundConnectionById(admin, input.connectionId)) ??
      (await ensureGrowthStubOutboundConnection(admin, input.actorUserId))
    : await ensureGrowthStubOutboundConnection(admin, input.actorUserId)

  const verify = adapter.verifyWebhookSignature({
    headers: new Headers(),
    rawBody: JSON.stringify(input.payload),
    secret: connection.webhookSecret,
  })

  const envelopes = adapter.parseWebhookPayload(input.payload)
  const payloadRecord =
    envelopes.length === 1
      ? (envelopes[0] as unknown as Record<string, unknown>)
      : ({ events: envelopes } as Record<string, unknown>)

  const webhook = await insertGrowthProviderWebhook(admin, {
    connectionId: connection.id,
    provider: input.provider,
    headers: input.headers ?? {},
    payload: payloadRecord,
    signatureValid: verify.ok,
    resolutionStatus: "resolved",
  })

  const results: ProcessOutboundEventResult[] = []
  let unresolved = false

  for (const envelope of envelopes) {
    const normalized = adapter.normalizeEvent(envelope)
    const result = await processOutboundEvent(admin, connection, normalized, webhook.id)
    results.push(result)
    if (result.unresolved) unresolved = true
  }

  await updateGrowthProviderWebhook(admin, webhook.id, {
    status: "processed",
    resolutionStatus: unresolved ? "unresolved" : "resolved",
    processedAt: new Date().toISOString(),
    resolvedLeadId: results.find((r) => r.leadId)?.leadId ?? null,
  })

  return { webhookId: webhook.id, results }
}

export async function processOutboundFixture(
  admin: SupabaseClient,
  fixture: OutboundFixtureEnvelope,
  actorUserId?: string | null,
): Promise<ProcessOutboundEventResult> {
  const { results } = await ingestOutboundWebhookPayload(admin, {
    provider: fixture.provider,
    payload: fixture,
    actorUserId,
  })
  return results[0] ?? { ok: false, error: "no_events" }
}

export async function replayGrowthProviderWebhookForLead(
  admin: SupabaseClient,
  webhookId: string,
  leadId: string,
): Promise<ProcessOutboundEventResult[]> {
  const webhook = await fetchGrowthProviderWebhookById(admin, webhookId)
  if (!webhook) throw new Error("webhook_not_found")

  const adapter = getOutboundProviderAdapter(webhook.provider)
  const envelopes = adapter.parseWebhookPayload(webhook.payload)
  const connection = await fetchGrowthOutboundConnectionById(admin, webhook.connectionId)
  if (!connection) throw new Error("connection_not_found")

  const results: ProcessOutboundEventResult[] = []
  for (const envelope of envelopes) {
    const normalized = adapter.normalizeEvent(envelope as OutboundFixtureEnvelope)
    const result = await processOutboundEvent(admin, connection, normalized, webhook.id, {
      forcedLeadId: leadId,
    })
    results.push(result)
  }

  await updateGrowthProviderWebhook(admin, webhookId, {
    status: "processed",
    resolutionStatus: "resolved",
    resolvedLeadId: leadId,
    processedAt: new Date().toISOString(),
  })

  return results
}
