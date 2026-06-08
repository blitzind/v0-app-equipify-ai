/** Voice drop delivery evidence — VD-1B observability (client-safe). */

import { VOICE_DROP_TWILIO_VD_1B_QA_MARKER } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"
import type {
  VoiceDropDeliveryAttemptPublicView,
  VoiceDropRecipientPublicView,
} from "@/lib/voice/voice-drops/types"

export { VOICE_DROP_TWILIO_VD_1B_QA_MARKER }

export type VoiceDropDeliveryAttemptEvidenceView = {
  id: string
  provider: VoiceDropDeliveryAttemptPublicView["provider"]
  providerDeliveryId: string | null
  status: VoiceDropDeliveryAttemptPublicView["status"]
  failureReason: string | null
  answeredBy: string | null
  callStatus: string | null
  startedAt: string | null
  completedAt: string | null
  deliveredAt: string | null
  durationSeconds: number | null
  createdAt: string
  evidenceText: string | null
  hasRawCallbackPayload: boolean
}

export type VoiceDropRecipientDeliveryEvidenceView = {
  recipient: VoiceDropRecipientPublicView
  latestAttempt: VoiceDropDeliveryAttemptEvidenceView | null
  attemptCount: number
}

export type VoiceDropCampaignDeliveryEvidenceSnapshot = {
  qaMarker: typeof VOICE_DROP_TWILIO_VD_1B_QA_MARKER
  campaignId: string
  generatedAt: string
  recipients: VoiceDropRecipientDeliveryEvidenceView[]
}

export function mapDeliveryAttemptToEvidenceView(
  attempt: VoiceDropDeliveryAttemptPublicView,
): VoiceDropDeliveryAttemptEvidenceView {
  const metadata = attempt.metadata ?? {}
  return {
    id: attempt.id,
    provider: attempt.provider,
    providerDeliveryId: attempt.providerDeliveryId,
    status: attempt.status,
    failureReason: attempt.failureReason,
    answeredBy: typeof metadata.answeredBy === "string" ? metadata.answeredBy : null,
    callStatus: typeof metadata.callStatus === "string" ? metadata.callStatus : null,
    startedAt:
      typeof metadata.startedAt === "string"
        ? metadata.startedAt
        : typeof metadata.createdAt === "string"
          ? metadata.createdAt
          : attempt.createdAt,
    completedAt: typeof metadata.completedAt === "string" ? metadata.completedAt : null,
    deliveredAt: attempt.deliveredAt,
    durationSeconds: attempt.durationSeconds,
    createdAt: attempt.createdAt,
    evidenceText: typeof metadata.evidenceText === "string" ? metadata.evidenceText : null,
    hasRawCallbackPayload: Boolean(metadata.rawCallbackPayload),
  }
}
