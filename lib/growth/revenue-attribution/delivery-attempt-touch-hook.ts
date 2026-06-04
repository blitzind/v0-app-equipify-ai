import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordAttributionTouch } from "@/lib/growth/revenue-attribution/record-attribution-touch"
import { resolveAttributionContextFromAttempt } from "@/lib/growth/revenue-attribution/resolve-attribution-context"

/** Record email/SMS send touch when a delivery attempt reaches sent status. */
export async function recordSendAttributionTouchForDeliveryAttempt(
  admin: SupabaseClient,
  deliveryAttemptId: string,
): Promise<void> {
  const ctx = await resolveAttributionContextFromAttempt(admin, deliveryAttemptId)
  if (!ctx) return

  const { data: attempt } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("channel, sent_at, status")
    .eq("id", deliveryAttemptId)
    .maybeSingle()

  if (!attempt || String(attempt.status) !== "sent") return

  const channel = String(attempt.channel ?? "email").toLowerCase()
  const touchType = channel === "sms" ? "sms_send" : "email_send"

  await recordAttributionTouch(admin, {
    touchType,
    leadId: ctx.leadId,
    touchedAt: attempt.sent_at ? String(attempt.sent_at) : undefined,
    opportunityId: ctx.opportunityId,
    channel,
    sequenceId: ctx.sequenceId,
    sequenceStepId: ctx.sequenceStepId,
    sequenceEnrollmentId: ctx.sequenceEnrollmentId,
    senderAccountId: ctx.senderAccountId,
    repUserId: ctx.repUserId,
    campaignId: ctx.campaignId,
    deliveryAttemptId,
    attributionSource: "delivery_attempt_sent",
    attributionConfidence: 0.95,
    resolveContext: false,
  }).catch(() => undefined)
}
