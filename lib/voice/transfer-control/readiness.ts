import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceTransferControlReadinessSnapshot } from "@/lib/voice/transfer-control/types"
import { VOICE_TRANSFER_CONTROL_QA_MARKER } from "@/lib/voice/transfer-control/types"

export async function fetchVoiceTransferControlReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceTransferControlReadinessSnapshot> {
  const warnings: string[] = []
  const hasTwilioCredentials = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim(),
  )
  const hasConferenceFromNumber = Boolean(
    process.env.TWILIO_VOICE_FROM_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim(),
  )

  let schemaReady = true
  for (const table of [
    "voice_call_legs",
    "voice_conferences",
    "voice_conference_participants",
    "voice_call_transfers",
  ]) {
    const { error } = await admin.schema("voice").from(table).select("id").limit(0)
    if (error) {
      schemaReady = false
      warnings.push(`Missing or inaccessible table voice.${table}. Apply migration 20270527180000.`)
      break
    }
  }

  let transferReadiness: VoiceTransferControlReadinessSnapshot["transferReadiness"] = "stub_only"
  let supervisorJoinReadiness: VoiceTransferControlReadinessSnapshot["supervisorJoinReadiness"] = "stub_only"
  let providerConferenceCapability: VoiceTransferControlReadinessSnapshot["providerConferenceCapability"] = "stub"

  if (!schemaReady) {
    transferReadiness = "schema_pending"
    supervisorJoinReadiness = "schema_pending"
    providerConferenceCapability = "unsupported"
  } else if (hasTwilioCredentials && hasConferenceFromNumber) {
    transferReadiness = "ready"
    supervisorJoinReadiness = "ready"
    providerConferenceCapability = "twilio_conference"
  } else if (hasTwilioCredentials) {
    transferReadiness = "missing_credentials"
    supervisorJoinReadiness = "missing_credentials"
    providerConferenceCapability = "twilio_conference"
    warnings.push("Set TWILIO_VOICE_FROM_NUMBER for live conference participant dialing.")
  } else {
    warnings.push("Twilio credentials not configured — transfer/conference actions run in stub mode.")
  }

  const multiPartyCallControlReady = schemaReady && (transferReadiness === "ready" || transferReadiness === "stub_only")

  return {
    qaMarker: VOICE_TRANSFER_CONTROL_QA_MARKER,
    multiPartyCallControlReady,
    transferReadiness,
    supervisorJoinReadiness,
    providerConferenceCapability,
    message: multiPartyCallControlReady
      ? "Multi-party call control scaffolding is ready. Live Twilio conferences require credentials and from-number."
      : "Apply voice transfer control migration 20270527180000 before using live transfer features.",
    warnings,
  }
}
