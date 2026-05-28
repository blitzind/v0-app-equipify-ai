import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveVoiceBrowserCallingProvider } from "@/lib/voice/browser-calling/provider-registry"
import type { VoiceBrowserCallingReadinessSnapshot } from "@/lib/voice/browser-calling/types"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "@/lib/voice/browser-calling/types"
import { countVoiceBrowserPresenceSummary } from "@/lib/voice/repository/voice-browser-calling-repository"

export async function fetchVoiceBrowserCallingReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceBrowserCallingReadinessSnapshot> {
  const provider = resolveVoiceBrowserCallingProvider()
  const tokenProbe = await provider.createAccessToken({
    organizationId,
    userId: "readiness-probe",
    clientIdentity: `org_${organizationId.slice(0, 8)}_user_readiness_probe`,
  })
  const summary = await countVoiceBrowserPresenceSummary(admin, organizationId)

  const warnings: string[] = []
  let tokenReadiness: VoiceBrowserCallingReadinessSnapshot["tokenReadiness"] = "stub_only"
  if (tokenProbe.stubMode) {
    if (tokenProbe.message.includes("TWILIO_TWIML_APP_SID")) tokenReadiness = "missing_twiml_app"
    else if (tokenProbe.message.includes("TWILIO_ACCOUNT_SID")) tokenReadiness = "missing_credentials"
    else tokenReadiness = "stub_only"
    warnings.push(tokenProbe.message)
  } else {
    tokenReadiness = "ready"
  }

  return {
    qaMarker: VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER,
    browserCallingReady: tokenReadiness === "ready",
    tokenReadiness,
    voiceSdkReadiness: tokenReadiness,
    websocketReadiness: "browser_supported",
    microphoneGuidance:
      "Grant microphone permission in the browser before placing or answering calls. Use Chrome or Edge for best Twilio Voice SDK support.",
    browserCompatibilityNote:
      "WebRTC browser calling requires HTTPS (or localhost). Telnyx WebRTC support is scaffolded for future phases.",
    connectedOperatorCount: summary.connectedOperatorCount,
    activeDeviceCount: summary.activeDeviceCount,
    warnings,
  }
}
