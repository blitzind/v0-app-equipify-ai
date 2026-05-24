import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { fetchGrowthOutboundConnectionById } from "@/lib/growth/outbound/connection-repository"
import { upsertGrowthOutboundContact } from "@/lib/growth/outbound/contact-repository"
import { upsertGrowthOutboundMessage } from "@/lib/growth/outbound/message-repository"
import { getOutboundProviderAdapter } from "@/lib/growth/outbound/providers/registry"
import {
  fetchGrowthProviderConnectionInternal,
  readGrowthProviderConnectionCredentials,
} from "@/lib/growth/outbound/provider-connection-repository"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  insertGrowthOutreachQueueEvent,
  updateGrowthOutreachQueueItem,
} from "@/lib/growth/outreach/outreach-queue-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import {
  emitGrowthLeadOutreachExecutedTimeline,
  emitGrowthLeadOutreachFailedTimeline,
} from "@/lib/growth/timeline-emitter"

export async function executeGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthOutreachQueueItem> {
  const lead = await fetchGrowthLeadById(admin, input.queueItem.leadId)
  if (!lead) throw new Error("not_found")

  let generationType: GrowthAiCopilotGenerationType | null = null
  let generationApproved = !input.queueItem.generationId
  if (input.queueItem.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, input.queueItem.generationId)
    if (!generation || generation.status !== "approved") throw new Error("generation_not_approved")
    generationType = generation.generationType
    generationApproved = true
  }

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: input.queueItem.channel,
    toEmail: input.queueItem.payloadSnapshot.toEmail ?? lead.contactEmail,
    generationType,
    generationApproved,
  })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: input.queueItem.id,
    eventType: "execution_started",
    actorUserId: input.actingUserId,
  })

  if (input.queueItem.channel !== "email") {
    const now = new Date().toISOString()
    const updated = await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
      status: "executed",
      executedAt: now,
    })
    await insertGrowthOutreachQueueEvent(admin, {
      queueId: input.queueItem.id,
      eventType: "executed",
      actorUserId: input.actingUserId,
      metadata: { channel: input.queueItem.channel, manual: true },
    })
    await emitGrowthLeadOutreachExecutedTimeline(admin, {
      leadId: lead.id,
      queueId: updated.id,
      channel: updated.channel,
      summary: updated.payloadSnapshot.subject ?? updated.channel,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
    return updated
  }

  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  const connectionId = input.queueItem.providerConnectionId ?? settings.activeEmailConnectionId
  if (!connectionId) throw new Error("no_provider_connection")

  const connection = await fetchGrowthOutboundConnectionById(admin, connectionId)
  if (!connection || connection.status !== "active") throw new Error("provider_unavailable")

  const connectionInternal = await fetchGrowthProviderConnectionInternal(admin, connectionId)
  if (!connectionInternal) throw new Error("provider_unavailable")

  const adapter = getOutboundProviderAdapter(connection.provider)
  if (adapter.declaredCapabilities().supports_send === "unavailable") {
    throw new Error("provider_send_unavailable")
  }
  const credentials = readGrowthProviderConnectionCredentials(connectionInternal)
  const to = input.queueItem.payloadSnapshot.toEmail ?? lead.contactEmail
  const subject = input.queueItem.payloadSnapshot.subject ?? "Follow up"
  const body = input.queueItem.payloadSnapshot.body ?? ""

  const validation = await adapter.validateExecution({
    connection,
    credentials,
    message: { to: to!, subject, body },
  })
  if (!validation.ok) {
    const now = new Date().toISOString()
    await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
      status: "failed",
      failedAt: now,
      failureReason: validation.message ?? "Execution validation failed.",
    })
    await insertGrowthOutreachQueueEvent(admin, {
      queueId: input.queueItem.id,
      eventType: "failed",
      actorUserId: input.actingUserId,
      metadata: { reason: validation.message },
    })
    await emitGrowthLeadOutreachFailedTimeline(admin, {
      leadId: lead.id,
      queueId: input.queueItem.id,
      channel: input.queueItem.channel,
      summary: validation.message ?? "Execution validation failed.",
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
    throw new Error("validation_failed")
  }

  const result = await adapter.execute({
    connection,
    credentials,
    message: { to: to!, subject, body, metadata: { queueId: input.queueItem.id } },
  })

  if (!result.ok) {
    const now = new Date().toISOString()
    await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
      status: "failed",
      failedAt: now,
      failureReason: result.message,
    })
    await insertGrowthOutreachQueueEvent(admin, {
      queueId: input.queueItem.id,
      eventType: "failed",
      actorUserId: input.actingUserId,
      metadata: { code: result.code, reason: result.message },
    })
    await emitGrowthLeadOutreachFailedTimeline(admin, {
      leadId: lead.id,
      queueId: input.queueItem.id,
      channel: input.queueItem.channel,
      summary: result.message,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
    throw new Error("execution_failed")
  }

  const contact = await upsertGrowthOutboundContact(admin, {
    connectionId: connection.id,
    leadId: lead.id,
    email: to!,
    campaignId: input.queueItem.campaignId,
  })

  const message = await upsertGrowthOutboundMessage(admin, {
    connectionId: connection.id,
    contactId: contact.id,
    leadId: lead.id,
    campaignId: input.queueItem.campaignId,
    providerMessageId: result.providerMessageId,
    subject,
    bodyPreview: body,
    sentAt: new Date().toISOString(),
    status: "sent",
    metadata: { outreachQueueId: input.queueItem.id, stub: result.raw.stub === true },
  })

  const now = new Date().toISOString()
  const updated = await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
    status: "executed",
    executedAt: now,
    outboundMessageId: message.id,
    providerConnectionId: connection.id,
  })

  if (input.queueItem.generationId) {
    await admin
      .schema("growth")
      .from("ai_copilot_generations")
      .update({ sent_at: now, outreach_queue_id: input.queueItem.id })
      .eq("id", input.queueItem.generationId)
  }

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: input.queueItem.id,
    eventType: "executed",
    actorUserId: input.actingUserId,
    metadata: { providerMessageId: result.providerMessageId, outboundMessageId: message.id },
  })

  await emitGrowthLeadOutreachExecutedTimeline(admin, {
    leadId: lead.id,
    queueId: updated.id,
    channel: updated.channel,
    summary: subject,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return updated
}
