import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listVoiceDropDeliveryAttemptsForCampaign,
  listVoiceDropRecipients,
} from "@/lib/voice/repository/voice-drop-repository"
import {
  mapDeliveryAttemptToEvidenceView,
  type VoiceDropCampaignDeliveryEvidenceSnapshot,
  VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
} from "@/lib/voice/voice-drops/voice-drop-delivery-evidence-types"

export async function fetchVoiceDropCampaignDeliveryEvidence(
  admin: SupabaseClient,
  input: { organizationId: string; campaignId: string },
): Promise<VoiceDropCampaignDeliveryEvidenceSnapshot> {
  const [recipients, attempts] = await Promise.all([
    listVoiceDropRecipients(admin, input.organizationId, input.campaignId),
    listVoiceDropDeliveryAttemptsForCampaign(admin, input.organizationId, input.campaignId),
  ])

  const attemptsByRecipient = new Map<string, typeof attempts>()
  for (const attempt of attempts) {
    const list = attemptsByRecipient.get(attempt.recipientId) ?? []
    list.push(attempt)
    attemptsByRecipient.set(attempt.recipientId, list)
  }

  return {
    qaMarker: VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
    campaignId: input.campaignId,
    generatedAt: new Date().toISOString(),
    recipients: recipients.map((recipient) => {
      const recipientAttempts = attemptsByRecipient.get(recipient.id) ?? []
      const latestAttempt = recipientAttempts[0] ?? null
      return {
        recipient,
        latestAttempt: latestAttempt ? mapDeliveryAttemptToEvidenceView(latestAttempt) : null,
        attemptCount: recipientAttempts.length,
      }
    }),
  }
}
