/** Twilio voice drop status webhook mapping — VD-1B (client-safe). */

import {
  mapVoiceDropAnsweredByToDeliveryOutcome,
  normalizeVoiceDropAnsweredBy,
} from "@/lib/voice/voice-drops/twilio-voice-drop-twiml"
import type { VoiceDropDeliveryStatus, VoiceDropRecipientStatus } from "@/lib/voice/voice-drops/types"
import { VOICE_DROP_TWILIO_VD_1B_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"

export type VoiceDropStatusWebhookPayload = {
  CallSid?: string | null
  CallStatus?: string | null
  AnsweredBy?: string | null
  CallDuration?: string | null
  Duration?: string | null
  ErrorCode?: string | null
  ErrorMessage?: string | null
  Timestamp?: string | null
  [key: string]: unknown
}

export type VoiceDropStatusWebhookAttemptPatch = {
  status: VoiceDropDeliveryStatus
  failureReason: string | null
  deliveredAt: string | null
  durationSeconds: number | null
  metadata: Record<string, unknown>
}

export type VoiceDropStatusWebhookRecipientPatch = {
  status: VoiceDropRecipientStatus
  suppressionReason: string | null
  lastAttemptAt: string
}

export type VoiceDropStatusWebhookPlan =
  | {
      kind: "finalized"
      auditEvent: "voice_drop_delivery_finalized"
      attemptPatch: VoiceDropStatusWebhookAttemptPatch
      recipientPatch: VoiceDropStatusWebhookRecipientPatch
    }
  | {
      kind: "interim"
      auditEvent: "voice_drop_status_interim"
      attemptPatch: VoiceDropStatusWebhookAttemptPatch
      recipientPatch: VoiceDropStatusWebhookRecipientPatch | null
    }
  | {
      kind: "noop"
      auditEvent: "voice_drop_status_ignored"
      reason: string
    }
  | {
      kind: "invalid"
      auditEvent: "voice_drop_status_invalid"
      reason: string
    }

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function sanitizeVoiceDropStatusWebhookPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function mapTwilioCallStatusToInterimAttemptStatus(callStatus: string | null): VoiceDropDeliveryStatus | null {
  const normalized = callStatus?.toLowerCase() ?? ""
  if (normalized === "completed") return null
  if (normalized === "in-progress" || normalized === "answered") return "in_progress"
  if (normalized === "ringing" || normalized === "initiated" || normalized === "queued") return "queued"
  if (
    normalized === "failed" ||
    normalized === "busy" ||
    normalized === "no-answer" ||
    normalized === "canceled"
  ) {
    return "failed"
  }
  return null
}

export function mapTwilioTerminalCallStatusToFailureReason(input: {
  callStatus: string | null
  errorCode?: string | null
  errorMessage?: string | null
}): string {
  const normalized = input.callStatus?.toLowerCase() ?? "unknown"
  if (normalized === "busy") return "twilio_busy"
  if (normalized === "no-answer" || normalized === "no_answer") return "twilio_no_answer"
  if (normalized === "canceled" || normalized === "cancelled") return "twilio_canceled"
  if (normalized === "failed") {
    if (input.errorCode) return `twilio_failed_${input.errorCode}`
    if (input.errorMessage) return "twilio_failed"
    return "twilio_failed"
  }
  return normalized
}

export function planVoiceDropStatusWebhookUpdate(input: {
  payload: VoiceDropStatusWebhookPayload
  existingAttemptMetadata: Record<string, unknown>
  nowIso: string
}): VoiceDropStatusWebhookPlan {
  const callSid = readString(input.payload.CallSid)
  if (!callSid) {
    return { kind: "invalid", auditEvent: "voice_drop_status_invalid", reason: "missing_call_sid" }
  }

  const callStatus = readString(input.payload.CallStatus)
  const answeredBy = normalizeVoiceDropAnsweredBy(readString(input.payload.AnsweredBy))
  const durationRaw = readString(input.payload.CallDuration) ?? readString(input.payload.Duration)
  const durationSeconds = durationRaw ? Number.parseInt(durationRaw, 10) : null
  const sanitizedPayload = sanitizeVoiceDropStatusWebhookPayload(input.payload as Record<string, unknown>)
  const callbackAt = readString(input.payload.Timestamp) ?? input.nowIso

  const baseMetadata = {
    ...input.existingAttemptMetadata,
    answeredBy,
    callStatus,
    callSid,
    qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
    lastCallbackAt: callbackAt,
    rawCallbackPayload: sanitizedPayload,
  }

  if (callStatus?.toLowerCase() === "completed") {
    const outcome = mapVoiceDropAnsweredByToDeliveryOutcome(answeredBy)
    const finalStatus: VoiceDropDeliveryStatus = outcome.delivered ? "delivered" : "failed"

    return {
      kind: "finalized",
      auditEvent: "voice_drop_delivery_finalized",
      attemptPatch: {
        status: finalStatus,
        failureReason: outcome.failureReason,
        deliveredAt: outcome.delivered ? input.nowIso : null,
        durationSeconds: Number.isFinite(durationSeconds ?? NaN) ? durationSeconds : null,
        metadata: {
          ...baseMetadata,
          completedAt: input.nowIso,
          startedAt: input.existingAttemptMetadata.startedAt ?? input.existingAttemptMetadata.createdAt ?? input.nowIso,
        },
      },
      recipientPatch: {
        status: outcome.delivered ? "delivered" : "failed",
        suppressionReason: outcome.delivered ? null : outcome.failureReason,
        lastAttemptAt: input.nowIso,
      },
    }
  }

  const interimStatus = mapTwilioCallStatusToInterimAttemptStatus(callStatus)
  if (!interimStatus) {
    return {
      kind: "noop",
      auditEvent: "voice_drop_status_ignored",
      reason: callStatus ? `unhandled_status_${callStatus}` : "missing_call_status",
    }
  }

  const failureReason =
    interimStatus === "failed"
      ? mapTwilioTerminalCallStatusToFailureReason({
          callStatus,
          errorCode: readString(input.payload.ErrorCode),
          errorMessage: readString(input.payload.ErrorMessage),
        })
      : null

  const attemptPatch: VoiceDropStatusWebhookAttemptPatch = {
    status: interimStatus,
    failureReason,
    deliveredAt: null,
    durationSeconds: Number.isFinite(durationSeconds ?? NaN) ? durationSeconds : null,
    metadata: {
      ...baseMetadata,
      startedAt:
        interimStatus === "in_progress" || interimStatus === "queued"
          ? (input.existingAttemptMetadata.startedAt as string | undefined) ?? input.nowIso
          : input.existingAttemptMetadata.startedAt,
    },
  }

  let recipientPatch: VoiceDropStatusWebhookRecipientPatch | null = null
  if (interimStatus === "in_progress") {
    recipientPatch = {
      status: "queued",
      suppressionReason: null,
      lastAttemptAt: input.nowIso,
    }
  } else if (interimStatus === "failed") {
    recipientPatch = {
      status: "failed",
      suppressionReason: failureReason,
      lastAttemptAt: input.nowIso,
    }
  }

  return {
    kind: "interim",
    auditEvent: "voice_drop_status_interim",
    attemptPatch,
    recipientPatch,
  }
}
