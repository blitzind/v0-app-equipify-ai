import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"

const POSITIVE_INTENTS = new Set(["positive_interest", "meeting_request", "demo_request", "pricing_question", "referral"])
const STOP_INTENTS = new Set(["unsubscribe", "not_interested", "wrong_contact"])

export async function recordCampaignReplyLearning(
  admin: SupabaseClient,
  input: {
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
    senderAccountId?: string | null
    classification: ReplyIntentClassificationV2Result
  },
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { data: existing } = await admin
    .schema("growth")
    .from("campaign_reply_learning_snapshots")
    .select("*")
    .eq("snapshot_date", snapshotDate)
    .eq("sequence_enrollment_id", input.sequenceEnrollmentId ?? null)
    .eq("sender_account_id", input.senderAccountId ?? null)
    .maybeSingle()

  const base = (existing as Record<string, unknown> | null) ?? {}
  const metrics = (base.metrics as Record<string, unknown> | null) ?? {}
  const total = Number(base.total_replies ?? 0) + 1
  const positive = Number(metrics.positive_replies ?? 0) + (POSITIVE_INTENTS.has(input.classification.intent) ? 1 : 0)
  const objections = Number(metrics.objection_replies ?? 0) + (input.classification.intent === "objection" || input.classification.intent === "timing_delay" ? 1 : 0)
  const unsub = Number(metrics.unsubscribe_replies ?? 0) + (input.classification.intent === "unsubscribe" ? 1 : 0)
  const wrongPerson = Number(metrics.wrong_person_replies ?? 0) + (input.classification.intent === "wrong_contact" ? 1 : 0)
  const demo = Number(metrics.demo_request_replies ?? 0) + (input.classification.intent === "demo_request" || input.classification.intent === "meeting_request" ? 1 : 0)
  const pricing = Number(metrics.pricing_question_replies ?? 0) + (input.classification.intent === "pricing_question" ? 1 : 0)

  const rate = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0)
  const qualityPenalty = objections * 8 + unsub * 15 + wrongPerson * 10
  const qualityBonus = positive * 5
  const replyQualityScore = Math.max(0, Math.min(100, Math.round(100 - qualityPenalty + qualityBonus)))

  const row = {
    snapshot_date: snapshotDate,
    campaign_id: input.campaignId ?? null,
    sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    sender_account_id: input.senderAccountId ?? null,
    total_replies: total,
    positive_reply_rate: rate(positive),
    objection_rate: rate(objections),
    unsubscribe_reply_rate: rate(unsub),
    wrong_person_rate: rate(wrongPerson),
    demo_request_rate: rate(demo),
    pricing_question_rate: rate(pricing),
    reply_quality_score: replyQualityScore,
    metrics: {
      positive_replies: positive,
      objection_replies: objections,
      unsubscribe_replies: unsub,
      wrong_person_replies: wrongPerson,
      demo_request_replies: demo,
      pricing_question_replies: pricing,
      last_intent: input.classification.intent,
      stop_intent: STOP_INTENTS.has(input.classification.intent),
      confidence_tier: input.classification.confidenceTier,
    },
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await admin.schema("growth").from("campaign_reply_learning_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("campaign_reply_learning_snapshots").insert(row)
  }

  await admin.schema("growth").from("campaign_engagement_metrics").upsert(
    {
      snapshot_date: snapshotDate,
      campaign_id: input.campaignId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      sender_account_id: input.senderAccountId ?? null,
      positive_replies: positive,
      negative_replies: objections + unsub + wrongPerson,
      unsubscribe_intents: unsub,
      reply_quality_score: replyQualityScore,
      metadata: {
        learning_snapshot: true,
        demo_request_rate: rate(demo),
        pricing_question_rate: rate(pricing),
        last_intent: input.classification.intent,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "snapshot_date,sequence_enrollment_id,sender_account_id" },
  ).catch(() => undefined)
}

export async function fetchAggregateCampaignReplyLearning(
  admin: SupabaseClient,
  input?: { sinceDays?: number },
): Promise<{
  positiveReplyRate: number
  objectionRate: number
  unsubscribeReplyRate: number
  demoRequestRate: number
  pricingQuestionRate: number
}> {
  const sinceDays = input?.sinceDays ?? 30
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await admin
    .schema("growth")
    .from("campaign_reply_learning_snapshots")
    .select("positive_reply_rate, objection_rate, unsubscribe_reply_rate, demo_request_rate, pricing_question_rate, total_replies")
    .gte("snapshot_date", since)

  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length === 0) {
    return {
      positiveReplyRate: 0,
      objectionRate: 0,
      unsubscribeReplyRate: 0,
      demoRequestRate: 0,
      pricingQuestionRate: 0,
    }
  }

  let totalWeight = 0
  let positive = 0
  let objection = 0
  let unsub = 0
  let demo = 0
  let pricing = 0

  for (const row of rows as Array<Record<string, unknown>>) {
    const weight = Number(row.total_replies ?? 1)
    totalWeight += weight
    positive += Number(row.positive_reply_rate ?? 0) * weight
    objection += Number(row.objection_rate ?? 0) * weight
    unsub += Number(row.unsubscribe_reply_rate ?? 0) * weight
    demo += Number(row.demo_request_rate ?? 0) * weight
    pricing += Number(row.pricing_question_rate ?? 0) * weight
  }

  const avg = (value: number) => (totalWeight > 0 ? Math.round((value / totalWeight) * 10) / 10 : 0)

  return {
    positiveReplyRate: avg(positive),
    objectionRate: avg(objection),
    unsubscribeReplyRate: avg(unsub),
    demoRequestRate: avg(demo),
    pricingQuestionRate: avg(pricing),
  }
}
