import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildVoiceInboundTwilioUrl, buildVoiceRecordingCallbackUrl, buildVoiceStatusWebhookUrl } from "@/lib/voice/call-control/urls"
import {
  recordingPolicyComplianceMessage,
} from "@/lib/voice/call-control/recording-policy"
import type { VoiceCallControlReadinessSnapshot } from "@/lib/voice/call-control/types"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import { fetchVoiceCallControlSettings } from "@/lib/voice/repository/voice-call-control-repository"

export async function fetchVoiceCallControlReadiness(
  admin: SupabaseClient,
  organizationId: string,
  origin?: string | null,
): Promise<VoiceCallControlReadinessSnapshot> {
  const settings = await fetchVoiceCallControlSettings(admin, organizationId)
  const defaultRecordingPolicy = settings?.defaultRecordingPolicy ?? "disabled"

  return {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    inboundWebhookUrl: buildVoiceInboundTwilioUrl(origin),
    statusWebhookUrl: buildVoiceStatusWebhookUrl(origin),
    recordingCallbackUrl: buildVoiceRecordingCallbackUrl(origin),
    inboundCallControlReady: settings?.inboundCallControlReady ?? false,
    voicemailCallbackReady: settings?.voicemailCallbackReady ?? false,
    defaultRecordingPolicy,
    recordingDisclosureText: settings?.recordingDisclosureText ?? "This call may be recorded for quality assurance.",
    recordingDisclosureMessage: recordingPolicyComplianceMessage(),
    callControlMessage:
      "Inbound call-control returns deterministic TwiML only. AI receptionist, live transfer execution, and SMS follow-up are future phases.",
  }
}
