import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createTwilioVoiceProvider } from "@/lib/voice/providers/twilio-provider"
import {
  getVoiceDropCampaign,
  getVoiceDropDeliveryAttemptByProviderDeliveryId,
  getVoiceDropRecipientForDelivery,
  updateVoiceDropDeliveryAttempt,
  updateVoiceDropRecipient,
} from "@/lib/voice/repository/voice-drop-repository"
import { parseTwilioFormBody, twilioFormBodyToPayload } from "@/lib/voice/webhooks/normalizer"
import { normalizeVoiceDropAnsweredBy } from "@/lib/voice/voice-drops/twilio-voice-drop-twiml"
import { resolveVoiceDropTwimlDeliveryContext } from "@/lib/voice/voice-drops/twilio-voice-drop-twiml-context"
import {
  planVoiceDropStatusWebhookUpdate,
  sanitizeVoiceDropStatusWebhookPayload,
} from "@/lib/voice/voice-drops/twilio-voice-drop-status-mapping"
import {
  VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
} from "@/lib/voice/voice-drops/twilio-voice-drop-config"
import { VOICE_DROP_TWILIO_VD_1B_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function validateTwilioVoiceDropWebhook(input: {
  rawBody: string
  requestUrl: string
  signatureHeader: string | null
  formParams: Record<string, string>
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const skipSignatureValidation = process.env.VOICE_WEBHOOK_SKIP_SIGNATURE_VALIDATION?.trim() === "true"
  if (skipSignatureValidation) return { ok: true }

  const twilio = createTwilioVoiceProvider()
  const validation = await twilio.validateWebhook({
    signatureHeader: input.signatureHeader,
    url: input.requestUrl,
    rawBody: input.rawBody,
    params: input.formParams,
  })

  if (!validation.ok) {
    return { ok: false, message: validation.message ?? "Twilio signature validation failed." }
  }
  return { ok: true }
}

export async function resolveVoiceDropTwimlResponse(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recipientId: string
    payload: Record<string, unknown>
  },
): Promise<{ contentType: "application/xml"; body: string } | { error: string }> {
  const recipient = await getVoiceDropRecipientForDelivery(admin, input.organizationId, input.recipientId)
  if (!recipient) {
    logVoiceInfrastructure("voice_drop_twiml_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      recipientId: input.recipientId,
      reason: "recipient_not_found",
    })
    return { error: "recipient_not_found" }
  }

  const campaign = await getVoiceDropCampaign(admin, input.organizationId, recipient.campaignId)
  const answeredBy = normalizeVoiceDropAnsweredBy(readString(input.payload.AnsweredBy))

  const resolved = resolveVoiceDropTwimlDeliveryContext({
    recipient: {
      campaignId: recipient.campaignId,
      renderedMessagePreview: recipient.renderedMessagePreview,
    },
    campaign: campaign
      ? { messageTemplate: campaign.messageTemplate, voiceId: campaign.voiceId }
      : null,
    answeredBy,
  })

  if (!resolved.ok) {
    logVoiceInfrastructure("voice_drop_twiml_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      recipientId: input.recipientId,
      reason: resolved.error,
    })
    return { error: resolved.error }
  }

  logVoiceInfrastructure("voice_drop_twiml_served", {
    qaMarker: VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
    certificationMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
    recipientId: input.recipientId,
    answeredBy,
  })

  return { contentType: "application/xml", body: resolved.body }
}

export async function ingestVoiceDropTwilioStatusWebhook(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recipientId: string
    payload: Record<string, unknown>
  },
): Promise<{ ok: true; updated: boolean; auditEvent: string } | { ok: false; message: string }> {
  const callSid = readString(input.payload.CallSid)
  if (!callSid) {
    logVoiceInfrastructure("voice_drop_status_persist_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      reason: "missing_call_sid",
    })
    return { ok: false, message: "Missing CallSid." }
  }

  const attempt = await getVoiceDropDeliveryAttemptByProviderDeliveryId(admin, callSid)
  if (!attempt) {
    logVoiceInfrastructure("voice_drop_status_persist_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      callSid,
      reason: "delivery_attempt_not_found",
    })
    return { ok: false, message: "Delivery attempt not found for CallSid." }
  }

  if (attempt.organizationId !== input.organizationId || attempt.recipientId !== input.recipientId) {
    logVoiceInfrastructure("voice_drop_status_persist_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      callSid,
      reason: "context_mismatch",
    })
    return { ok: false, message: "Delivery attempt context mismatch." }
  }

  logVoiceInfrastructure("voice_drop_status_webhook_received", {
    qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
    callSid,
    callStatus: readString(input.payload.CallStatus),
    answeredBy: readString(input.payload.AnsweredBy),
  })

  const nowIso = new Date().toISOString()
  const plan = planVoiceDropStatusWebhookUpdate({
    payload: input.payload,
    existingAttemptMetadata: attempt.metadata,
    nowIso,
  })

  if (plan.kind === "invalid") {
    logVoiceInfrastructure("voice_drop_status_persist_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      callSid,
      reason: plan.reason,
    })
    return { ok: false, message: plan.reason }
  }

  if (plan.kind === "noop") {
    return { ok: true, updated: false, auditEvent: plan.auditEvent }
  }

  try {
    await updateVoiceDropDeliveryAttempt(admin, {
      organizationId: input.organizationId,
      attemptId: attempt.id,
      patch: plan.attemptPatch,
    })

    if (plan.recipientPatch) {
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: attempt.recipientId,
        patch: plan.recipientPatch,
      })
    }

    logVoiceInfrastructure(
      plan.kind === "finalized" ? "voice_drop_delivery_finalized" : "voice_drop_status_persisted",
      {
        qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
        callSid,
        attemptStatus: plan.attemptPatch.status,
        answeredBy: plan.attemptPatch.metadata.answeredBy,
        delivered: plan.kind === "finalized" && plan.attemptPatch.status === "delivered",
      },
    )

    return { ok: true, updated: true, auditEvent: plan.auditEvent }
  } catch (error) {
    logVoiceInfrastructure("voice_drop_status_persist_failed", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      callSid,
      reason: error instanceof Error ? error.message : "persist_failed",
    })
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to persist voice drop status callback.",
    }
  }
}

export function parseTwilioVoiceDropWebhookPayload(rawBody: string): Record<string, unknown> {
  const formParams = parseTwilioFormBody(rawBody)
  return sanitizeVoiceDropStatusWebhookPayload(twilioFormBodyToPayload(formParams))
}
