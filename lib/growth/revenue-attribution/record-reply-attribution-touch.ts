import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { recordAttributionTouch } from "@/lib/growth/revenue-attribution/record-attribution-touch"

/** Record reply touch for any ingested reply (not only positive intents). */
export async function recordReplyAttributionTouchForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId?: string | null
    touchedAt?: string
    sequenceEnrollmentId?: string | null
    deliveryAttemptId?: string | null
    senderAccountId?: string | null
    attributionSource?: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthAttributionTouch | null> {
  if (input.replyId) {
    const { data: existing } = await admin
      .schema("growth")
      .from("attribution_touches")
      .select("id,metadata")
      .eq("lead_id", input.leadId)
      .eq("touch_type", "reply")
      .limit(20)

    const duplicate = (existing ?? []).some(
      (row) => String((row as { metadata?: { outbound_reply_id?: string } }).metadata?.outbound_reply_id ?? "") === input.replyId,
    )
    if (duplicate) return null
  }

  return recordAttributionTouch(admin, {
    touchType: "reply",
    leadId: input.leadId,
    touchedAt: input.touchedAt,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    senderAccountId: input.senderAccountId ?? null,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
    attributionSource: input.attributionSource ?? "reply_ingested",
    attributionConfidence: 0.9,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.replyId ? { outbound_reply_id: input.replyId } : {}),
    },
  }).catch(() => null)
}
