import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-classifier"
import type { GrowthOutboundReplyClassification } from "@/lib/growth/outbound/types"

export type CampaignReplyClassification = {
  classification: GrowthOutboundReplyClassification
  intent: string
  sentiment: string
  confidence: number
  suppressFollowUp: boolean
  suppressReason: string | null
  engagementSignal: "positive" | "neutral" | "negative" | "stop"
}

const STOP_INTENTS = new Set(["unsubscribe", "not_interested", "wrong_contact"])
const POSITIVE_INTENTS = new Set(["positive_interest", "meeting_request", "pricing_question", "referral"])

export function classifyCampaignReply(bodyPreview: string | null | undefined): CampaignReplyClassification {
  const result = classifyReplyIntent(bodyPreview)
  let engagementSignal: CampaignReplyClassification["engagementSignal"] = "neutral"
  if (STOP_INTENTS.has(result.intent)) engagementSignal = "stop"
  else if (POSITIVE_INTENTS.has(result.intent)) engagementSignal = "positive"
  else if (result.sentiment === "negative") engagementSignal = "negative"

  const suppressFollowUp = engagementSignal === "stop" || engagementSignal === "positive"
  const suppressReason = suppressFollowUp
    ? engagementSignal === "positive"
      ? "Positive reply received — suppress automated follow-ups."
      : "Unsubscribe/stop intent detected — suppress follow-ups."
    : null

  return {
    classification: result.classification,
    intent: result.intent,
    sentiment: result.sentiment,
    confidence: result.confidence,
    suppressFollowUp,
    suppressReason,
    engagementSignal,
  }
}

export function computeSenderReplyQualityScore(input: {
  positiveReplies: number
  negativeReplies: number
  unsubscribeIntents: number
  totalReplies: number
}): number {
  if (input.totalReplies === 0) return 100
  const penalty = input.negativeReplies * 8 + input.unsubscribeIntents * 15
  const bonus = input.positiveReplies * 5
  return Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)))
}

export async function upsertCampaignEngagementMetrics(
  admin: SupabaseClient,
  input: {
    sequenceEnrollmentId?: string | null
    campaignId?: string | null
    senderAccountId?: string | null
    reply: CampaignReplyClassification
  },
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const { data: existing } = await admin
    .schema("growth")
    .from("campaign_engagement_metrics")
    .select("*")
    .eq("snapshot_date", snapshotDate)
    .eq("sequence_enrollment_id", input.sequenceEnrollmentId ?? null)
    .maybeSingle()

  const base = (existing as Record<string, unknown> | null) ?? {}
  const positive = Number(base.positive_replies ?? 0) + (input.reply.engagementSignal === "positive" ? 1 : 0)
  const neutral = Number(base.neutral_replies ?? 0) + (input.reply.engagementSignal === "neutral" ? 1 : 0)
  const negative = Number(base.negative_replies ?? 0) + (input.reply.engagementSignal === "negative" ? 1 : 0)
  const unsub = Number(base.unsubscribe_intents ?? 0) + (input.reply.intent === "unsubscribe" ? 1 : 0)
  const total = positive + neutral + negative

  await admin.schema("growth").from("campaign_engagement_metrics").upsert(
    {
      snapshot_date: snapshotDate,
      campaign_id: input.campaignId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      sender_account_id: input.senderAccountId ?? null,
      positive_replies: positive,
      neutral_replies: neutral,
      negative_replies: negative,
      unsubscribe_intents: unsub,
      reply_quality_score: computeSenderReplyQualityScore({
        positiveReplies: positive,
        negativeReplies: negative,
        unsubscribeIntents: unsub,
        totalReplies: total,
      }),
      engagement_decay_score: negative * 10 + unsub * 20,
      metadata: { last_intent: input.reply.intent, confidence: input.reply.confidence },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "snapshot_date,sequence_enrollment_id,sender_account_id" },
  )
}

export async function shouldSuppressCampaignFollowUp(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId: string },
): Promise<{ suppress: boolean; reason: string | null }> {
  const { data } = await admin
    .schema("growth")
    .from("campaign_engagement_metrics")
    .select("positive_replies, unsubscribe_intents, reply_quality_score")
    .eq("sequence_enrollment_id", input.sequenceEnrollmentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { suppress: false, reason: null }
  const row = data as Record<string, unknown>
  if (Number(row.positive_replies ?? 0) > 0) {
    return { suppress: true, reason: "Positive reply recorded — follow-ups suppressed." }
  }
  if (Number(row.unsubscribe_intents ?? 0) > 0) {
    return { suppress: true, reason: "Unsubscribe intent recorded." }
  }
  if (Number(row.reply_quality_score ?? 100) < 40) {
    return { suppress: false, reason: "Low reply quality — recommend reduced cadence (operator review)." }
  }
  return { suppress: false, reason: null }
}
