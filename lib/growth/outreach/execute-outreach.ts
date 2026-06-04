import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { fetchGrowthOutboundConnectionById } from "@/lib/growth/outbound/connection-repository"
import { upsertGrowthOutboundCampaign } from "@/lib/growth/outbound/campaign-repository"
import { upsertGrowthOutboundContact } from "@/lib/growth/outbound/contact-repository"
import { upsertGrowthOutboundMessage } from "@/lib/growth/outbound/message-repository"
import {
  beginAdapterDeliveryAttempt,
  completeAdapterDeliveryAttempt,
  failAdapterDeliveryAttempt,
} from "@/lib/growth/outbound/adapter-delivery-telemetry"
import { getOutboundProviderAdapter } from "@/lib/growth/outbound/providers/registry"
import {
  fetchGrowthProviderConnectionInternal,
  readGrowthProviderConnectionCredentials,
} from "@/lib/growth/outbound/provider-connection-repository"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"
import { runOutreachExecutionGuard } from "@/lib/growth/outreach/outreach-execution-guard"
import { markOutreachQueueFailure } from "@/lib/growth/outreach/outreach-queue-recovery"
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
import { emitGrowthProviderExecutionFailedNotification } from "@/lib/growth/notifications/notification-integrations"
import { parseLemlistConnectionConfig } from "@/lib/growth/outbound/providers/lemlist/lemlist-config"
import { LEMLIST_PROVIDER_KEY } from "@/lib/growth/outbound/providers/lemlist/lemlist-labels"
import { assertGrowthProductionRuntimeSafe } from "@/lib/growth/runtime/runtime-guards"

async function maybeAdvanceSequenceEnrollmentAfterExecute(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    actingUserId: string
    actingUserEmail: string
  },
): Promise<void> {
  if (!input.queueItem.sequenceEnrollmentStepId) return
  const { advanceGrowthSequenceEnrollmentAfterStep } = await import(
    "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
  )
  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: input.queueItem.sequenceEnrollmentStepId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })
}

async function recordOutreachFailure(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    leadId: string
    channel: string
    reason: string
    code?: string | null
    blockCode?: string | null
    actingUserId: string
    actingUserEmail: string
    deliveryAttemptId?: string | null
  },
): Promise<never> {
  const updated = await markOutreachQueueFailure(admin, {
    queueItem: input.queueItem,
    reason: input.reason,
    code: input.code,
    blockCode: input.blockCode,
    actingUserId: input.actingUserId,
    deliveryAttemptId: input.deliveryAttemptId,
  })

  await emitGrowthLeadOutreachFailedTimeline(admin, {
    leadId: input.leadId,
    queueId: updated.id,
    channel: input.channel as GrowthOutreachQueueItem["channel"],
    summary: input.reason,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  }).catch(() => undefined)

  await emitGrowthProviderExecutionFailedNotification(admin, {
    leadId: input.leadId,
    queueId: updated.id,
    companyName: "",
    reason: input.reason,
    ownerUserId: null,
  }).catch(() => undefined)

  throw new Error(input.code ?? "execution_failed")
}

export async function executeGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    queueItem: GrowthOutreachQueueItem
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthOutreachQueueItem> {
  assertGrowthProductionRuntimeSafe("outreach_queue_execute")
  const { assertAdapterOutboundExecutionAllowed } = await import("@/lib/growth/runtime/outbound-cutover")
  assertAdapterOutboundExecutionAllowed("executeGrowthOutreachQueueItem")

  const lead = await fetchGrowthLeadById(admin, input.queueItem.leadId)
  if (!lead) throw new Error("not_found")

  let generationType: GrowthAiCopilotGenerationType | null = null
  let generationApproved = !input.queueItem.generationId
  if (input.queueItem.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, input.queueItem.generationId)
    if (!generation || generation.status !== "approved") {
      await recordOutreachFailure(admin, {
        queueItem: input.queueItem,
        leadId: lead.id,
        channel: input.queueItem.channel,
        reason: "AI draft must be approved before send.",
        code: "generation_not_approved",
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
      })
    }
    generationType = generation.generationType
    generationApproved = true
  }

  const guard = await runOutreachExecutionGuard(admin, {
    queueItem: input.queueItem,
    lead,
    generationType,
    generationApproved,
  })
  if (!guard.allowed) {
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: guard.reason,
      code: guard.code,
      blockCode: guard.blockCode,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
    processingStartedAt: new Date().toISOString(),
  })

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
      processingStartedAt: null,
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
    await maybeAdvanceSequenceEnrollmentAfterExecute(admin, input)
    return updated
  }

  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  const connectionId = input.queueItem.providerConnectionId ?? settings.activeEmailConnectionId
  if (!connectionId) {
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: "No active email provider connection configured.",
      code: "no_provider_connection",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  const connection = await fetchGrowthOutboundConnectionById(admin, connectionId!)
  if (!connection || connection.status !== "active") {
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: "Email provider connection unavailable.",
      code: "provider_unavailable",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  const connectionInternal = await fetchGrowthProviderConnectionInternal(admin, connectionId!)
  if (!connectionInternal) {
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: "Email provider connection unavailable.",
      code: "provider_unavailable",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  const adapter = getOutboundProviderAdapter(connection!.provider)
  if (adapter.declaredCapabilities().supports_send === "unavailable") {
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: "Provider send unavailable for this connection.",
      code: "provider_send_unavailable",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }

  const credentials = readGrowthProviderConnectionCredentials(connectionInternal!)
  const to = input.queueItem.payloadSnapshot.toEmail ?? lead.contactEmail
  const subject = input.queueItem.payloadSnapshot.subject ?? "Follow up"
  const body = input.queueItem.payloadSnapshot.body ?? ""
  const telemetryStartedAt = Date.now()

  const deliveryAttempt = await beginAdapterDeliveryAttempt(admin, {
    providerConnectionId: connection!.id,
    leadId: lead.id,
    outreachQueueId: input.queueItem.id,
    toEmail: to!,
    subject,
    providerFamily: connection!.provider,
  }).catch(() => null)

  if (deliveryAttempt) {
    await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
      deliveryAttemptId: deliveryAttempt.id,
    })
  }

  let localCampaignId = input.queueItem.campaignId
  if (connection!.provider === LEMLIST_PROVIDER_KEY) {
    const lemlistConfig = parseLemlistConnectionConfig(connection!.config)
    const providerCampaignId = lemlistConfig.defaultCampaignId
    if (!providerCampaignId) {
      if (deliveryAttempt) {
        await failAdapterDeliveryAttempt(admin, {
          attemptId: deliveryAttempt.id,
          reason: "Lemlist campaign not configured.",
          code: "lemlist_campaign_not_configured",
          startedAtMs: telemetryStartedAt,
        })
      }
      await recordOutreachFailure(admin, {
        queueItem: input.queueItem,
        leadId: lead.id,
        channel: input.queueItem.channel,
        reason: "Lemlist campaign not configured.",
        code: "lemlist_campaign_not_configured",
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
        deliveryAttemptId: deliveryAttempt?.id,
      })
    }
    const campaign = await upsertGrowthOutboundCampaign(admin, {
      connectionId: connection!.id,
      provider: connection!.provider,
      providerCampaignId,
      name: input.queueItem.payloadSnapshot.campaignName ?? "Lemlist campaign",
      sourceChannel: lead.sourceChannel,
      sourceCampaign: lead.sourceCampaign,
    })
    localCampaignId = campaign.id
  }

  const validation = await adapter.validateExecution({
    connection: connection!,
    credentials,
    message: {
      to: to!,
      subject,
      body,
      metadata: {
        queueId: input.queueItem.id,
        leadId: lead.id,
        contactName: lead.contactName,
        companyName: lead.companyName,
        campaignId: parseLemlistConnectionConfig(connection!.config).defaultCampaignId,
      },
    },
  })

  if (!validation.ok) {
    if (deliveryAttempt) {
      await failAdapterDeliveryAttempt(admin, {
        attemptId: deliveryAttempt.id,
        reason: validation.message ?? "Execution validation failed.",
        code: "validation_failed",
        startedAtMs: telemetryStartedAt,
      })
    }
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: validation.message ?? "Execution validation failed.",
      code: "validation_failed",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      deliveryAttemptId: deliveryAttempt?.id,
    })
  }

  const result = await adapter.execute({
    connection: connection!,
    credentials,
    message: {
      to: to!,
      subject,
      body,
      metadata: {
        queueId: input.queueItem.id,
        leadId: lead.id,
        contactName: lead.contactName,
        companyName: lead.companyName,
        campaignId: parseLemlistConnectionConfig(connection!.config).defaultCampaignId,
      },
    },
  })

  if (!result.ok) {
    if (deliveryAttempt) {
      await failAdapterDeliveryAttempt(admin, {
        attemptId: deliveryAttempt.id,
        reason: result.message,
        code: result.code,
        startedAtMs: telemetryStartedAt,
      })
    }
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: result.message,
      code: result.code,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      deliveryAttemptId: deliveryAttempt?.id,
    })
  }

  if (result.raw.stub === true) {
    if (deliveryAttempt) {
      await failAdapterDeliveryAttempt(admin, {
        attemptId: deliveryAttempt.id,
        reason: "Simulated provider send blocked in production runtime.",
        code: "simulated_send_blocked",
        startedAtMs: telemetryStartedAt,
        metadata: { simulated: true },
      })
    }
    await recordOutreachFailure(admin, {
      queueItem: input.queueItem,
      leadId: lead.id,
      channel: input.queueItem.channel,
      reason: "Simulated provider send blocked — configure live provider for production.",
      code: "simulated_send_blocked",
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      deliveryAttemptId: deliveryAttempt?.id,
    })
  }

  const contact = await upsertGrowthOutboundContact(admin, {
    connectionId: connection!.id,
    leadId: lead.id,
    email: to!,
    campaignId: localCampaignId,
    providerContactId:
      typeof result.raw.contactId === "string"
        ? result.raw.contactId
        : typeof result.raw.leadId === "string"
          ? result.raw.leadId
          : null,
  })

  const message = await upsertGrowthOutboundMessage(admin, {
    connectionId: connection!.id,
    contactId: contact.id,
    leadId: lead.id,
    campaignId: localCampaignId,
    providerMessageId: result.providerMessageId,
    subject,
    bodyPreview: body,
    sentAt: new Date().toISOString(),
    status: "sent",
    metadata: {
      outreachQueueId: input.queueItem.id,
      provider: connection!.provider,
      providerSubmission: true,
      deliveryAttemptId: deliveryAttempt?.id ?? null,
      providerCampaignId: typeof result.raw.campaignId === "string" ? result.raw.campaignId : null,
      providerLeadId: typeof result.raw.leadId === "string" ? result.raw.leadId : null,
    },
  })

  if (deliveryAttempt) {
    await completeAdapterDeliveryAttempt(admin, {
      attemptId: deliveryAttempt.id,
      providerMessageId: result.providerMessageId,
      startedAtMs: telemetryStartedAt,
      metadata: {
        outbound_message_id: message.id,
        provider: connection!.provider,
      },
    })
  }

  const now = new Date().toISOString()
  const updated = await updateGrowthOutreachQueueItem(admin, input.queueItem.id, {
    status: "executed",
    executedAt: now,
    outboundMessageId: message.id,
    providerConnectionId: connection!.id,
    processingStartedAt: null,
    failureClass: null,
    failureReason: null,
    deliveryAttemptId: deliveryAttempt?.id ?? null,
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
    metadata: {
      providerMessageId: result.providerMessageId,
      outboundMessageId: message.id,
      deliveryAttemptId: deliveryAttempt?.id ?? null,
    },
  })

  await emitGrowthLeadOutreachExecutedTimeline(admin, {
    leadId: lead.id,
    queueId: updated.id,
    channel: updated.channel,
    summary: subject,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  await maybeAdvanceSequenceEnrollmentAfterExecute(admin, input)

  return updated
}
