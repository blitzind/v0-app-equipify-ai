import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import {
  buildGrowthSmsStatusCallbackUrl,
  isGrowthSmsLiveSendEnabled,
  resolveDefaultGrowthSmsProviderKind,
  resolveGrowthSmsProvider,
} from "@/lib/growth/sms/providers/sms-provider-registry"
import {
  createSmsDeliveryAttempt,
  fetchGrowthSmsWorkspaceSettings,
  getSmsDeliveryAttemptByIdempotencyKey,
  insertSmsMessage,
  updateSmsConversationActivity,
  updateSmsDeliveryAttempt,
} from "@/lib/growth/sms/sms-repository"
import { appendSmsMessageToInboxBridge, findOrCreateSmsConversation } from "@/lib/growth/sms/sms-threading"
import type { GrowthSmsSendInput, GrowthSmsSendResult } from "@/lib/growth/sms/sms-types"

export async function sendSms(
  admin: SupabaseClient,
  input: GrowthSmsSendInput & { requestOrigin?: string | null },
): Promise<GrowthSmsSendResult> {
  const toE164 = normalizeToE164(input.toE164)
  if (!toE164) {
    return { ok: false, code: "invalid_phone", message: "Recipient phone must be valid E.164." }
  }

  const body = input.body.trim()
  if (!body) {
    return { ok: false, code: "empty_body", message: "SMS body is required." }
  }
  if (body.length > 1600) {
    return { ok: false, code: "body_too_long", message: "SMS body exceeds 1600 characters." }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  const settings = await fetchGrowthSmsWorkspaceSettings(admin)
  if (!settings || settings.status !== "active") {
    return { ok: false, code: "sms_inactive", message: "Growth SMS workspace is not active." }
  }

  const providerKind = settings.providerKind === "noop" ? resolveDefaultGrowthSmsProviderKind() : settings.providerKind
  const fromE164 = settings.fromE164
  const idempotencyKey = input.idempotencyKey?.trim() || `sms:${input.leadId}:${toE164}:${randomUUID()}`

  const existingAttempt = await getSmsDeliveryAttemptByIdempotencyKey(admin, idempotencyKey)
  if (existingAttempt) {
    const messageId =
      typeof existingAttempt.metadata.message_id === "string" ? existingAttempt.metadata.message_id : ""
    return {
      ok: true,
      deliveryAttemptId: existingAttempt.id,
      conversationId: existingAttempt.conversationId ?? "",
      messageId,
      providerMessageId: existingAttempt.providerMessageId,
      status: existingAttempt.status,
    }
  }

  const conversation = await findOrCreateSmsConversation(admin, {
    leadId: lead.id,
    participantE164: toE164,
    organizationId: lead.promotedOrganizationId,
  })

  const attempt = await createSmsDeliveryAttempt(admin, {
    organizationId: lead.promotedOrganizationId,
    leadId: lead.id,
    conversationId: conversation.id,
    provider: providerKind,
    fromE164,
    toE164,
    body,
    idempotencyKey,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    sequenceEnrollmentStepId: input.sequenceEnrollmentStepId ?? null,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    metadata: {
      acting_user_id: input.actingUserId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      sequence_enrollment_step_id: input.sequenceEnrollmentStepId ?? null,
      sequence_execution_job_id: input.sequenceExecutionJobId ?? null,
      ...(input.metadata ?? {}),
    },
  })

  const liveSend = isGrowthSmsLiveSendEnabled()
  const provider = resolveGrowthSmsProvider(liveSend ? providerKind : "noop")
  const sendResult = await provider.send({
    fromE164,
    toE164,
    body,
    idempotencyKey,
    messagingServiceSid: settings.messagingServiceSid,
    statusCallbackUrl: buildGrowthSmsStatusCallbackUrl(input.requestOrigin),
  })

  const now = new Date().toISOString()

  if (!sendResult.ok) {
    const failed = await updateSmsDeliveryAttempt(admin, attempt.id, {
      status: "failed",
      failureReason: sendResult.message,
      failedAt: now,
    })
    logGrowthEngine("sms_send_failed", {
      leadId: lead.id,
      deliveryAttemptId: attempt.id,
      code: sendResult.code,
    })
    return { ok: false, code: sendResult.code, message: sendResult.message }
  }

  const updatedAttempt = await updateSmsDeliveryAttempt(admin, attempt.id, {
    status: sendResult.status === "sent" ? "sent" : "queued",
    providerMessageId: sendResult.providerMessageId,
    sentAt: now,
    metadata: { ...attempt.metadata, message_id: null },
  })

  const message = await insertSmsMessage(admin, {
    conversationId: conversation.id,
    direction: "outbound",
    body,
    fromE164,
    toE164,
    provider: providerKind,
    providerMessageId: sendResult.providerMessageId,
    status: sendResult.status === "sent" ? "sent" : "queued",
    deliveryAttemptId: attempt.id,
    messageTimestamp: now,
    metadata: { idempotency_key: idempotencyKey },
  })

  await updateSmsDeliveryAttempt(admin, attempt.id, {
    metadata: { ...updatedAttempt.metadata, message_id: message.id },
  })

  await updateSmsConversationActivity(admin, conversation.id, {
    bodyPreview: body,
    messageTimestamp: now,
  })

  await appendSmsMessageToInboxBridge(admin, {
    conversation,
    direction: "outbound",
    body,
    fromE164,
    toE164,
    providerMessageId: sendResult.providerMessageId,
    messageTimestamp: now,
  })

  logGrowthEngine("sms_sent", {
    leadId: lead.id,
    deliveryAttemptId: attempt.id,
    conversationId: conversation.id,
    providerMessageId: sendResult.providerMessageId,
    liveSend,
  })

  return {
    ok: true,
    deliveryAttemptId: attempt.id,
    conversationId: conversation.id,
    messageId: message.id,
    providerMessageId: sendResult.providerMessageId,
    status: sendResult.status === "sent" ? "sent" : "queued",
  }
}
