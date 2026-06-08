"use client"

import type { VoiceDropCampaignDeliveryEvidenceSnapshot } from "@/lib/voice/voice-drops/voice-drop-delivery-evidence-types"
import { VOICE_DROP_TWILIO_VD_1B_QA_MARKER } from "@/lib/voice/voice-drops/voice-drop-delivery-evidence-types"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

export function GrowthVoiceDropDeliveryEvidencePanel(props: {
  evidence: VoiceDropCampaignDeliveryEvidenceSnapshot | null
}) {
  const { evidence } = props
  if (!evidence) return null

  const rows = evidence.recipients.filter((row) => row.latestAttempt || row.recipient.deliveryAttemptCount > 0)
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-voice-drop-delivery-evidence-qa-marker={VOICE_DROP_TWILIO_VD_1B_QA_MARKER}>
        No delivery attempts recorded for this campaign yet.
      </p>
    )
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3"
      data-voice-drop-delivery-evidence-qa-marker={VOICE_DROP_TWILIO_VD_1B_QA_MARKER}
    >
      <p className="text-sm font-medium">Delivery evidence</p>
      {rows.map(({ recipient, latestAttempt, attemptCount }) => (
        <div key={recipient.id} className="rounded-md border border-border/40 px-3 py-2 text-xs">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-medium">{recipient.phoneNumber}</span>
            <GrowthBadge label={recipient.status.replace(/_/g, " ")} tone="neutral" />
            {latestAttempt ? (
              <GrowthBadge label={latestAttempt.status.replace(/_/g, " ")} tone="neutral" />
            ) : null}
          </div>
          {latestAttempt ? (
            <ul className="grid gap-1 text-muted-foreground sm:grid-cols-2">
              <li>CallSid: {latestAttempt.providerDeliveryId ?? "—"}</li>
              <li>Answered by: {latestAttempt.answeredBy ?? "—"}</li>
              <li>Call status: {latestAttempt.callStatus ?? "—"}</li>
              <li>Failure: {latestAttempt.failureReason ?? recipient.suppressionReason ?? "—"}</li>
              <li>Started: {latestAttempt.startedAt ?? "—"}</li>
              <li>Completed: {latestAttempt.completedAt ?? latestAttempt.deliveredAt ?? "—"}</li>
              <li>Attempts: {attemptCount}</li>
              <li>Raw callback stored: {latestAttempt.hasRawCallbackPayload ? "yes" : "no"}</li>
            </ul>
          ) : (
            <p className="text-muted-foreground">Recipient attempts: {recipient.deliveryAttemptCount}</p>
          )}
        </div>
      ))}
    </div>
  )
}
