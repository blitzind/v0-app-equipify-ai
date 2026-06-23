import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadDecisionMakerById } from "@/lib/growth/decision-maker-repository"
import { recomputeGrowthOutboundCampaignMetrics, upsertGrowthOutboundCampaign } from "@/lib/growth/outbound/campaign-repository"
import { upsertGrowthOutboundContact, setGrowthOutboundContactSuppressed } from "@/lib/growth/outbound/contact-repository"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"
import {
  findGrowthMessageEventByProviderId,
  insertGrowthMessageEvent,
} from "@/lib/growth/outbound/event-repository"
import {
  findGrowthOutboundMessageByProviderId,
  touchGrowthOutboundMessageMetadata,
  upsertGrowthOutboundMessage,
} from "@/lib/growth/outbound/message-repository"
import type { NormalizedOutboundEvent, ProcessOutboundEventResult } from "@/lib/growth/outbound/types"
import { classifyReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-classifier"
import { ingestGrowthReplyFromWebhook } from "@/lib/growth/replies/reply-ingestion-pipeline"
import { insertGrowthOutboundReply } from "@/lib/growth/outbound/reply-repository"
import { resolveOutboundLeadByEmail } from "@/lib/growth/outbound/resolve-lead-by-email"
import { upsertGrowthSuppressionEntry } from "@/lib/growth/outbound/suppression-repository"
import {
  emitGrowthLeadEmailEventTimeline,
  emitGrowthLeadEmailSuppressedTimeline,
} from "@/lib/growth/outbound/timeline-emitter"
import { emitGrowthLeadStatusChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLeadStatus } from "@/lib/growth/types"

function trimPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function hasCallablePhone(leadPhone: string | null, dmPhone: string | null): boolean {
  return Boolean(trimPhone(leadPhone) || trimPhone(dmPhone))
}

async function resolveDmPhone(
  admin: SupabaseClient,
  leadId: string,
  decisionMakerId: string | null,
): Promise<string | null> {
  if (!decisionMakerId) return null
  const dm = await fetchGrowthLeadDecisionMakerById(admin, leadId, decisionMakerId)
  return dm?.phone ?? null
}

export async function processOutboundEvent(
  admin: SupabaseClient,
  connection: GrowthEmailProviderConnection,
  event: NormalizedOutboundEvent,
  webhookId?: string | null,
  options?: { forcedLeadId?: string; forcedDecisionMakerId?: string | null },
): Promise<ProcessOutboundEventResult> {
  const existing = await findGrowthMessageEventByProviderId(admin, connection.id, event.providerEventId)
  if (existing) {
    return { ok: true, duplicate: true, leadId: existing.leadId ?? undefined, messageEventId: existing.id }
  }

  const resolved = options?.forcedLeadId
    ? {
        leadId: options.forcedLeadId,
        decisionMakerId: options.forcedDecisionMakerId ?? null,
        email: event.email,
        rule: "outbound_contact" as const,
      }
    : await resolveOutboundLeadByEmail(admin, event.email)
  if (!resolved) {
    return { ok: false, unresolved: true, error: "lead_not_found_for_email" }
  }

  const lead = await fetchGrowthLeadById(admin, resolved.leadId)
  if (!lead) {
    return { ok: false, unresolved: true, error: "lead_missing" }
  }

  let campaignId: string | null = null
  if (event.providerCampaignId || event.campaignName) {
    const campaign = await upsertGrowthOutboundCampaign(admin, {
      connectionId: connection.id,
      provider: connection.provider,
      providerCampaignId: event.providerCampaignId,
      name: event.campaignName ?? "Outbound campaign",
      sourceChannel: lead.sourceChannel,
      sourceCampaign: lead.sourceCampaign,
    })
    campaignId = campaign.id
  }

  const contact = await upsertGrowthOutboundContact(admin, {
    connectionId: connection.id,
    campaignId,
    leadId: resolved.leadId,
    decisionMakerId: resolved.decisionMakerId,
    email: resolved.email,
    providerContactId: event.providerContactId,
    lastEventAt: event.occurredAt,
    firstContactedAt: event.eventType === "sent" ? event.occurredAt : undefined,
  })

  let messageId: string | null = null
  const messageProviderId =
    event.eventType === "replied"
      ? event.inReplyToProviderMessageId ?? event.providerMessageId
      : event.providerMessageId

  if (messageProviderId || ["sent", "delivered", "opened", "clicked", "replied", "bounced", "failed"].includes(event.eventType)) {
    const message = await upsertGrowthOutboundMessage(admin, {
      connectionId: connection.id,
      contactId: contact.id,
      leadId: resolved.leadId,
      campaignId,
      providerMessageId: messageProviderId,
      sequenceStep: event.sequenceStep,
      subject: event.subject,
      bodyPreview: event.bodyPreview,
      sentAt: event.eventType === "sent" ? event.occurredAt : undefined,
      deliveredAt: event.eventType === "delivered" ? event.occurredAt : undefined,
      status:
        event.eventType === "bounced"
          ? "bounced"
          : event.eventType === "failed"
            ? "failed"
            : event.eventType === "delivered"
              ? "delivered"
              : event.eventType === "sent"
                ? "sent"
                : undefined,
    })
    messageId = message.id

    if (event.eventType === "opened") {
      await touchGrowthOutboundMessageMetadata(admin, message.id, { lastOpenedAt: event.occurredAt })
    }
    if (event.eventType === "clicked") {
      await touchGrowthOutboundMessageMetadata(admin, message.id, { lastClickedAt: event.occurredAt })
    }
  }

  const messageEvent = await insertGrowthMessageEvent(admin, {
    connectionId: connection.id,
    leadId: resolved.leadId,
    contactId: contact.id,
    messageId,
    webhookId: webhookId ?? null,
    eventType: event.eventType,
    provider: event.provider,
    providerEventId: event.providerEventId,
    occurredAt: event.occurredAt,
    payload: {
      ...event.raw,
      campaignId,
      email: event.email,
      subject: event.subject,
      bodyPreview: event.bodyPreview,
    },
  })

  let replyId: string | null = null
  let insertedReply = null as Awaited<ReturnType<typeof insertGrowthOutboundReply>> | null
  if (event.eventType === "replied") {
    const classified = classifyReplyIntent(event.bodyPreview)
    insertedReply = await insertGrowthOutboundReply(admin, {
      connectionId: connection.id,
      messageId,
      contactId: contact.id,
      leadId: resolved.leadId,
      messageEventId: messageEvent.id,
      providerReplyId: event.providerReplyId,
      receivedAt: event.occurredAt,
      bodyPreview: event.bodyPreview,
      classification: classified.classification,
      sentiment: classified.sentiment,
      confidence: classified.confidence,
      rawPayload: event.raw,
    })
    replyId = insertedReply.id
  }

  if (event.eventType === "unsubscribed") {
    await upsertGrowthSuppressionEntry(admin, {
      email: event.email,
      reason: "unsubscribe",
      source: "provider_webhook",
      leadId: resolved.leadId,
      contactId: contact.id,
      messageEventId: messageEvent.id,
    })
    await setGrowthOutboundContactSuppressed(admin, contact.id)
    await emitGrowthLeadEmailSuppressedTimeline(admin, {
      leadId: resolved.leadId,
      email: event.email,
      reason: "unsubscribe",
      messageEventId: messageEvent.id,
    })
  }

  if (event.eventType === "bounced" && event.bounceType === "hard") {
    await upsertGrowthSuppressionEntry(admin, {
      email: event.email,
      reason: "bounce_hard",
      source: "provider_webhook",
      leadId: resolved.leadId,
      contactId: contact.id,
      messageEventId: messageEvent.id,
    })
    await setGrowthOutboundContactSuppressed(admin, contact.id)
    await emitGrowthLeadEmailSuppressedTimeline(admin, {
      leadId: resolved.leadId,
      email: event.email,
      reason: "bounce_hard",
      messageEventId: messageEvent.id,
    })
  }

  if (event.eventType === "spam_complaint") {
    await upsertGrowthSuppressionEntry(admin, {
      email: event.email,
      reason: "spam_complaint",
      source: "provider_webhook",
      leadId: resolved.leadId,
      contactId: contact.id,
      messageEventId: messageEvent.id,
    })
    await setGrowthOutboundContactSuppressed(admin, contact.id)
    await emitGrowthLeadEmailSuppressedTimeline(admin, {
      leadId: resolved.leadId,
      email: event.email,
      reason: "spam_complaint",
      messageEventId: messageEvent.id,
    })
  }

  let nextStatus: GrowthLeadStatus | null = null
  if (event.eventType === "sent" && !["converted", "disqualified", "archived", "call_ready"].includes(lead.status)) {
    if (["new", "researching", "enriched", "qualified", "in_outreach", "replied"].includes(lead.status)) {
      nextStatus = lead.status === "replied" ? "replied" : "in_outreach"
    }
  }

  if (event.eventType === "replied") {
    nextStatus = "replied"
    const dmPhone = await resolveDmPhone(admin, resolved.leadId, resolved.decisionMakerId)
    const classified = classifyReplyIntent(event.bodyPreview)
    if (classified.classification === "interested" && hasCallablePhone(lead.contactPhone, dmPhone)) {
      nextStatus = "call_ready"
    }
  }

  if (nextStatus && nextStatus !== lead.status) {
    await updateGrowthLead(admin, resolved.leadId, { status: nextStatus })
    await emitGrowthLeadStatusChangedTimeline(admin, {
      leadId: resolved.leadId,
      from: lead.status,
      to: nextStatus,
    })
  }

  await emitGrowthLeadEmailEventTimeline(admin, {
    leadId: resolved.leadId,
    event,
    messageEventId: messageEvent.id,
    outboundMessageId: messageId,
    outboundReplyId: replyId,
    campaignName: event.campaignName,
    classification: event.eventType === "replied" ? classifyReplyIntent(event.bodyPreview).classification : undefined,
  })

  if (event.eventType === "replied" && insertedReply) {
    const { finalizeIngestedReplyIntelligence } = await import(
      "@/lib/growth/replies/finalize-ingested-reply-intelligence"
    )
    await finalizeIngestedReplyIntelligence(admin, {
      leadId: resolved.leadId,
      outboundReply: insertedReply,
      bodyPreview: event.bodyPreview,
      senderEmail: event.email,
      campaignId: campaignId ?? null,
      ingestionEventId: (
        await ingestGrowthReplyFromWebhook(admin, {
          existingOutboundReplyId: insertedReply.id,
          existingMessageEventId: messageEvent.id,
          connectionId: connection.id,
          leadId: resolved.leadId,
          contactId: contact.id,
          messageId,
          receivedAt: event.occurredAt,
          bodyExcerpt: event.bodyPreview,
          subject: event.subject,
          senderEmail: event.email,
          providerReplyId: event.providerReplyId,
          providerFamily: event.provider,
          campaignId: campaignId ?? null,
          rawPayloadRef: event.raw,
        })
      ).ingestionEventId,
    })
  }

  if (campaignId) {
    await recomputeGrowthOutboundCampaignMetrics(admin, campaignId)
  }

  await admin
    .schema("growth")
    .from("email_provider_connections")
    .update({ last_webhook_at: new Date().toISOString(), last_error: null })
    .eq("id", connection.id)

  await recomputeGrowthLeadWorkflowSignals(admin, resolved.leadId)

  logGrowthEngine("outbound_event_processed", {
    leadId: resolved.leadId,
    eventType: event.eventType,
    providerEventId: event.providerEventId,
  })

  return {
    ok: true,
    leadId: resolved.leadId,
    messageEventId: messageEvent.id,
  }
}
