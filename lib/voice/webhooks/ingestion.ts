import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseTwilioCallCost } from "@/lib/voice/calls/cost-parsing"
import { mergeVoiceCallStatus } from "@/lib/voice/calls/lifecycle-engine"
import { mapProviderCallStatus } from "@/lib/voice/calls/status-mapping"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import { createVoiceProviderInstance } from "@/lib/voice/providers/registry"
import type { NormalizedVoiceWebhookEvent } from "@/lib/voice/providers/types"
import {
  appendVoiceCallEvent,
  findVoiceCallByProviderId,
  resolveVoiceOrganizationFromWebhook,
  upsertVoiceCallFromWebhook,
} from "@/lib/voice/repository/voice-repository"
import {
  attachCallToConversation,
  resolveConversationPhoneForCall,
  resolveOrCreateVoiceConversation,
} from "@/lib/voice/conversations/conversation-engine"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import type { VoiceCallDirection, VoiceProviderId } from "@/lib/voice/types"
import { sanitizeVoiceWebhookPayload } from "@/lib/voice/audit"
import {
  buildVoiceEventIdempotencyKey,
  findVoiceWebhookReceipt,
  insertVoiceWebhookReceipt,
} from "@/lib/voice/webhooks/idempotency"
import { normalizeVoiceWebhookEvent } from "@/lib/voice/webhooks/normalizer"
import type { VoiceWebhookIngestResult } from "@/lib/voice/webhooks/types"

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function mapTwilioLegStatus(status: string | null): "queued" | "ringing" | "in_progress" | "completed" | "failed" | "canceled" {
  const normalized = status?.toLowerCase() ?? ""
  if (normalized === "ringing") return "ringing"
  if (normalized === "answered" || normalized === "in-progress" || normalized === "in_progress") return "in_progress"
  if (normalized === "completed") return "completed"
  if (normalized === "canceled" || normalized === "cancelled") return "canceled"
  if (normalized === "busy" || normalized === "failed" || normalized === "no-answer" || normalized === "no_answer") {
    return "failed"
  }
  return "queued"
}

function resolveTwilioLegType(payload: Record<string, unknown>): "browser_client" | "pstn" {
  const to = readString(payload.To) ?? readString(payload.Called) ?? ""
  return to.toLowerCase().startsWith("client:") ? "browser_client" : "pstn"
}

async function upsertTwilioChildCallLegFromWebhook(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    providerCallSid: string
    payload: Record<string, unknown>
    eventTimestamp: string
  },
): Promise<void> {
  const status = mapTwilioLegStatus(readString(input.payload.CallStatus))
  const legType = resolveTwilioLegType(input.payload)
  const patch = {
    status,
    answered_at: status === "in_progress" ? input.eventTimestamp : null,
    ended_at: ["completed", "failed", "canceled"].includes(status) ? input.eventTimestamp : null,
    metadata_json: {
      parent_call_sid: readString(input.payload.ParentCallSid),
      dial_call_status: readString(input.payload.DialCallStatus),
      source: "twilio_dial_status_callback",
    },
  }

  const { data: existing } = await admin
    .schema("voice")
    .from("voice_call_legs")
    .select("id, answered_at, ended_at")
    .eq("organization_id", input.organizationId)
    .eq("provider", "twilio")
    .eq("provider_call_sid", input.providerCallSid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .schema("voice")
      .from("voice_call_legs")
      .update({
        status,
        answered_at: existing.answered_at ?? patch.answered_at,
        ended_at: existing.ended_at ?? patch.ended_at,
        metadata_json: patch.metadata_json,
      })
      .eq("id", existing.id as string)
    return
  }

  await admin.schema("voice").from("voice_call_legs").insert({
    organization_id: input.organizationId,
    voice_call_id: input.voiceCallId,
    provider: "twilio",
    provider_call_sid: input.providerCallSid,
    leg_type: legType,
    phone_number: readString(input.payload.To) ?? "",
    client_identity: legType === "browser_client" ? (readString(input.payload.To) ?? "").replace(/^client:/i, "") : "",
    status,
    started_at: input.eventTimestamp,
    answered_at: patch.answered_at,
    ended_at: patch.ended_at,
    metadata_json: patch.metadata_json,
  })
}

function resolveDirection(event: NormalizedVoiceWebhookEvent): VoiceCallDirection {
  if (event.direction === "inbound" || event.direction === "outbound") return event.direction
  return "inbound"
}

function resolveLifecycleTimestamps(
  status: ReturnType<typeof mapProviderCallStatus>,
  eventTimestamp: string,
  existing?: { answeredAt: string | null; endedAt: string | null },
): { answeredAt: string | null; endedAt: string | null } {
  if (status === "in_progress") {
    return { answeredAt: existing?.answeredAt ?? eventTimestamp, endedAt: existing?.endedAt ?? null }
  }
  if (status === "completed" || status === "failed" || status === "busy" || status === "no_answer" || status === "canceled") {
    return { answeredAt: existing?.answeredAt ?? null, endedAt: eventTimestamp }
  }
  return { answeredAt: existing?.answeredAt ?? null, endedAt: existing?.endedAt ?? null }
}

export async function ingestVoiceProviderWebhook(
  admin: SupabaseClient,
  input: {
    provider: VoiceProviderId
    rawBody: string
    payload: Record<string, unknown>
    signatureHeader?: string | null
    requestUrl: string
    formParams?: Record<string, string>
    skipSignatureValidation?: boolean
  },
): Promise<VoiceWebhookIngestResult> {
  const providerInstance = createVoiceProviderInstance(input.provider)
  const normalized = providerInstance.normalizeWebhookEvent(input.payload)
  if (!normalized) {
    logVoiceInfrastructure("voice_webhook_ingestion_failed", {
      provider: input.provider,
      reason: "invalid_payload",
    })
    return { ok: false, code: "invalid_payload", message: "Could not normalize provider webhook payload." }
  }

  if (!input.skipSignatureValidation) {
    const validation = await providerInstance.validateWebhook({
      signatureHeader: input.signatureHeader ?? null,
      url: input.requestUrl,
      rawBody: input.rawBody,
      params: input.formParams,
    })
    if (!validation.ok) {
      logVoiceInfrastructure("voice_webhook_signature_failed", {
        provider: input.provider,
        message: validation.message,
      })
      return {
        ok: false,
        code: "signature_failed",
        message: validation.message ?? "Webhook signature validation failed.",
      }
    }
  }

  const enriched = normalizeVoiceWebhookEvent(normalized)
  const accountSid = typeof input.payload.AccountSid === "string" ? input.payload.AccountSid : null
  const organizationId = await resolveVoiceOrganizationFromWebhook(admin, {
    provider: input.provider,
    accountSid,
    fromNumber: enriched.fromNumber,
    toNumber: enriched.toNumber,
  })
  if (!organizationId) {
    return {
      ok: false,
      code: "organization_unresolved",
      message: "Could not resolve organization for voice webhook.",
    }
  }

  const receiptKey = buildVoiceEventIdempotencyKey({
    provider: input.provider,
    providerCallId: enriched.providerCallId,
    eventType: enriched.canonicalEventType,
    eventTimestamp: enriched.eventTimestamp,
  })
  const existingReceipt = await findVoiceWebhookReceipt(admin, input.provider, receiptKey)
  if (existingReceipt) {
    logVoiceInfrastructure("voice_webhook_idempotent_skip", {
      provider: input.provider,
      providerCallId: enriched.providerCallId,
      idempotencyKey: receiptKey,
    })
    return {
      ok: true,
      duplicate: true,
      voiceCallId: existingReceipt.voice_call_id,
      normalizedEvent: enriched,
    }
  }

  const mappedStatus = mapProviderCallStatus(input.provider, enriched.providerStatus) ?? "initiated"
  const twilioParentCallSid = input.provider === "twilio" ? readString(input.payload.ParentCallSid) : null
  const parentCall = twilioParentCallSid
    ? await findVoiceCallByProviderId(admin, organizationId, input.provider, twilioParentCallSid)
    : null
  const canonicalProviderCallId = parentCall ? twilioParentCallSid! : enriched.providerCallId
  const priorCall = await findVoiceCallByProviderId(
    admin,
    organizationId,
    input.provider,
    canonicalProviderCallId,
  )
  const transition = mergeVoiceCallStatus(priorCall?.status ?? "queued", mappedStatus)
  const finalStatus = transition.ok ? transition.nextStatus : priorCall?.status ?? mappedStatus
  if (priorCall && finalStatus !== priorCall.status) {
    logVoiceInfrastructure("voice_call_lifecycle_transition", {
      providerCallId: enriched.providerCallId,
      from: priorCall.status,
      to: finalStatus,
    })
  }

  const lifecycle = resolveLifecycleTimestamps(finalStatus, enriched.eventTimestamp, {
    answeredAt: priorCall?.answeredAt ?? null,
    endedAt: priorCall?.endedAt ?? null,
  })

  const persistedCall = await upsertVoiceCallFromWebhook(admin, {
    organizationId,
    provider: input.provider,
    providerCallId: canonicalProviderCallId,
    direction: priorCall?.direction ?? resolveDirection(enriched),
    status: finalStatus,
    fromNumber: normalizePhoneNumber(enriched.fromNumber) || priorCall?.fromNumber || "",
    toNumber: normalizePhoneNumber(enriched.toNumber) || priorCall?.toNumber || "",
    startedAt: priorCall?.startedAt ?? enriched.eventTimestamp,
    answeredAt: lifecycle.answeredAt,
    endedAt: lifecycle.endedAt,
    durationSeconds: priorCall?.durationSeconds ?? 0,
    recordingAvailable: enriched.recordingAvailable || priorCall?.recordingAvailable || false,
    ...parseTwilioCallCost(enriched.payload),
    metadataJson: {
      ...(priorCall?.metadataJson ?? {}),
      last_canonical_event_type: enriched.canonicalEventType,
      last_provider_status: enriched.providerStatus,
      ...(accountSid ? { account_sid: accountSid } : {}),
    },
  })

  if (!persistedCall) {
    return { ok: false, code: "persistence_failed", message: "Failed to persist voice call record." }
  }

  if (input.provider === "twilio" && twilioParentCallSid && enriched.providerCallId !== twilioParentCallSid) {
    await upsertTwilioChildCallLegFromWebhook(admin, {
      organizationId,
      voiceCallId: persistedCall.id,
      providerCallSid: enriched.providerCallId,
      payload: input.payload,
      eventTimestamp: enriched.eventTimestamp,
    })
  }

  let voiceConversationId = persistedCall.voiceConversationId

  if (persistedCall.direction === "inbound") {
    const conversationPhone = resolveConversationPhoneForCall({
      direction: persistedCall.direction,
      fromNumber: persistedCall.fromNumber,
      toNumber: persistedCall.toNumber,
    })
    if (conversationPhone) {
      const conversation = await resolveOrCreateVoiceConversation(admin, {
        organizationId,
        primaryPhoneNumber: conversationPhone,
        activityAt: enriched.eventTimestamp,
      })
      if (conversation) {
        await attachCallToConversation(admin, {
          organizationId,
          voiceCallId: persistedCall.id,
          voiceConversationId: conversation.id,
          activityAt: enriched.eventTimestamp,
        })
        voiceConversationId = conversation.id
      }
    }
  }

  const eventKey = buildVoiceEventIdempotencyKey({
    provider: input.provider,
    providerCallId: enriched.providerCallId,
    eventType: enriched.canonicalEventType,
    eventTimestamp: enriched.eventTimestamp,
  })
  const eventResult = await appendVoiceCallEvent(admin, {
    organizationId,
    voiceCallId: persistedCall.id,
    provider: input.provider,
    eventType: enriched.canonicalEventType,
    eventTimestamp: enriched.eventTimestamp,
    payloadJson: sanitizeVoiceWebhookPayload(enriched.payload),
    idempotencyKey: eventKey,
  })
  if (!eventResult.ok && !eventResult.duplicate) {
    return { ok: false, code: "persistence_failed", message: "Failed to append voice call event." }
  }

  const receiptResult = await insertVoiceWebhookReceipt(admin, {
    organizationId,
    provider: input.provider,
    idempotencyKey: receiptKey,
    rawBody: input.rawBody,
    voiceCallId: persistedCall.id,
  })
  if (!receiptResult.ok && !receiptResult.duplicate) {
    return { ok: false, code: "persistence_failed", message: "Failed to record webhook receipt." }
  }

  logVoiceInfrastructure("voice_webhook_ingested", {
    provider: input.provider,
    organizationId,
    providerCallId: enriched.providerCallId,
    eventType: enriched.canonicalEventType,
    voiceCallId: persistedCall.id,
    voiceConversationId,
  })

  return {
    ok: true,
    duplicate: false,
    voiceCallId: persistedCall.id,
    voiceConversationId,
    normalizedEvent: enriched,
  }
}
