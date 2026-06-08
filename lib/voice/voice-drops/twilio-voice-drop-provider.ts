/** Twilio voice drop provider — VD-1A + VD-1B certification gates. */

import type {
  VoiceDropDeliveryResult,
  VoiceDropProvider,
  VoiceDropProviderContext,
} from "@/lib/voice/voice-drops/provider-types"
import { stubVoiceDropProvider } from "@/lib/voice/voice-drops/stub-provider"
import {
  cancelTwilioVoiceDropCall,
  createTwilioVoiceDropOutboundCall,
  fetchTwilioVoiceDropCall,
} from "@/lib/voice/voice-drops/twilio-voice-drop-client"
import {
  canPlaceTwilioVoiceDropCalls,
  isTwilioVoiceDropConfigured,
  resolveVoiceDropTwilioPublicOrigin,
  VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
} from "@/lib/voice/voice-drops/twilio-voice-drop-config"
import { evaluateVoiceDropTwilioQueueGate, VOICE_DROP_TWILIO_VD_1B_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"
import {
  mapVoiceDropAnsweredByToDeliveryOutcome,
  normalizeVoiceDropAnsweredBy,
} from "@/lib/voice/voice-drops/twilio-voice-drop-twiml"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

function mapTwilioCallStatusToDeliveryStatus(
  callStatus: string | null | undefined,
): VoiceDropDeliveryResult["status"] {
  const normalized = callStatus?.toLowerCase() ?? ""
  if (normalized === "completed") return "delivered"
  if (normalized === "failed" || normalized === "busy" || normalized === "no-answer" || normalized === "canceled") {
    return "failed"
  }
  if (normalized === "in-progress" || normalized === "ringing" || normalized === "answered") {
    return "in_progress"
  }
  return "queued"
}

export const twilioVoiceDropProvider: VoiceDropProvider = {
  id: "twilio",
  isConfigured() {
    return isTwilioVoiceDropConfigured()
  },
  validateRecipient(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized || normalized.length < 10) {
      return { valid: false, reason: "invalid_phone_number" }
    }
    return { valid: true, reason: null }
  },
  renderMessage(template, context) {
    return stubVoiceDropProvider.renderMessage(template, context)
  },
  async queueDelivery(context: VoiceDropProviderContext): Promise<VoiceDropDeliveryResult> {
    const gate = evaluateVoiceDropTwilioQueueGate()
    if (!gate.allowed) {
      logVoiceInfrastructure("voice_drop_provider_blocked", {
        qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
        reason: gate.reason,
        recipientId: context.recipientId,
        campaignId: context.campaignId,
      })
      return {
        providerDeliveryId: null,
        status: "failed",
        failureReason: gate.reason,
        evidenceText: gate.message,
      }
    }

    if (!this.isConfigured()) {
      return stubVoiceDropProvider.queueDelivery(context)
    }

    logVoiceInfrastructure("voice_drop_provider_call_create_attempted", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      recipientId: context.recipientId,
      campaignId: context.campaignId,
    })

    const createResult = await createTwilioVoiceDropOutboundCall({
      organizationId: context.organizationId,
      campaignId: context.campaignId,
      recipientId: context.recipientId,
      phoneNumber: context.phoneNumber,
      publicOrigin: resolveVoiceDropTwilioPublicOrigin(),
    })

    if (!createResult.ok) {
      logVoiceInfrastructure("voice_drop_provider_call_create_failed", {
        qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
        recipientId: context.recipientId,
        code: createResult.code,
        message: createResult.message,
      })
      return {
        providerDeliveryId: null,
        status: "failed",
        failureReason: createResult.code,
        evidenceText: createResult.message,
      }
    }

    logVoiceInfrastructure("voice_drop_provider_call_created", {
      qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
      recipientId: context.recipientId,
      callSid: createResult.callSid,
      callStatus: createResult.status,
    })

    const initialStatus = mapTwilioCallStatusToDeliveryStatus(createResult.status)

    return {
      providerDeliveryId: createResult.callSid,
      status: initialStatus === "failed" ? "failed" : "queued",
      failureReason: null,
      evidenceText: `Twilio outbound call created (${VOICE_DROP_TWILIO_VD_1A_QA_MARKER}) — AMD DetectMessageEnd, awaiting webhook completion.`,
    }
  },
  async fetchDeliveryStatus(providerDeliveryId: string): Promise<VoiceDropDeliveryResult> {
    if (!canPlaceTwilioVoiceDropCalls()) {
      return stubVoiceDropProvider.fetchDeliveryStatus(providerDeliveryId)
    }

    const fetched = await fetchTwilioVoiceDropCall(providerDeliveryId)
    if (!fetched.ok) {
      return {
        providerDeliveryId,
        status: "failed",
        failureReason: "twilio_fetch_failed",
        evidenceText: fetched.message ?? "Unable to fetch Twilio call status.",
      }
    }

    const answeredBy = normalizeVoiceDropAnsweredBy(fetched.answeredBy)
    const mappedStatus = mapTwilioCallStatusToDeliveryStatus(fetched.status)

    if (mappedStatus === "delivered" || fetched.status === "completed") {
      const outcome = mapVoiceDropAnsweredByToDeliveryOutcome(answeredBy)
      return {
        providerDeliveryId,
        status: outcome.delivered ? "delivered" : "failed",
        failureReason: outcome.failureReason,
        evidenceText: outcome.delivered
          ? "Voicemail drop delivered (machine_end_beep)."
          : `Call completed without voicemail drop (${outcome.failureReason ?? "unknown"}).`,
      }
    }

    return {
      providerDeliveryId,
      status: mappedStatus,
      failureReason: mappedStatus === "failed" ? fetched.status ?? "call_failed" : null,
      evidenceText: `Twilio call status: ${fetched.status ?? "unknown"}.`,
    }
  },
  async cancelDelivery(providerDeliveryId: string) {
    if (!canPlaceTwilioVoiceDropCalls()) {
      return stubVoiceDropProvider.cancelDelivery(providerDeliveryId)
    }
    return cancelTwilioVoiceDropCall(providerDeliveryId)
  },
}
