import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { recordRevenueAttributionEvent } from "@/lib/growth/revenue-intelligence/revenue-attribution"
import { GROWTH_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import type { DetectedRevenueOpportunitySignal } from "@/lib/growth/revenue-intelligence/opportunity-signal-engine"

export async function recordCampaignRevenueAttribution(
  admin: SupabaseClient,
  input: {
    leadId: string
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
    senderAccountId?: string | null
    domain?: string | null
    classification: ReplyIntentClassificationV2Result
    signals: DetectedRevenueOpportunitySignal[]
  },
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const demoRequests = input.signals.filter((s) => s.signalType === "demo_request").length
  const pricingQuestions = input.signals.filter((s) => s.signalType === "pricing_interest").length
  const positiveReplies = ["positive_interest", "demo_request", "meeting_request", "pricing_question"].includes(
    input.classification.intent,
  )
    ? 1
    : 0
  const opportunitiesGenerated = demoRequests + pricingQuestions > 0 ? 1 : 0

  const { data: existing } = await admin
    .schema("growth")
    .from("campaign_revenue_attribution_snapshots")
    .select("*")
    .eq("snapshot_date", snapshotDate)
    .eq("campaign_id", input.campaignId ?? null)
    .eq("sequence_enrollment_id", input.sequenceEnrollmentId ?? null)
    .maybeSingle()

  const base = (existing as Record<string, unknown> | null) ?? {}
  const metrics = (base.metrics as Record<string, unknown> | null) ?? {}

  const row = {
    snapshot_date: snapshotDate,
    campaign_id: input.campaignId ?? null,
    sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
    sender_account_id: input.senderAccountId ?? null,
    domain: input.domain ?? null,
    opportunities_generated: Number(base.opportunities_generated ?? 0) + opportunitiesGenerated,
    demo_requests: Number(base.demo_requests ?? 0) + demoRequests,
    pricing_questions: Number(base.pricing_questions ?? 0) + pricingQuestions,
    positive_replies: Number(base.positive_replies ?? 0) + positiveReplies,
    objection_replies: Number(base.objection_replies ?? 0) + (input.classification.intent === "objection" ? 1 : 0),
    attribution_weight: 1,
    metrics: {
      ...metrics,
      last_intent: input.classification.intent,
      signal_count: input.signals.length,
    },
    qa_marker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await admin.schema("growth").from("campaign_revenue_attribution_snapshots").update(row).eq("id", (existing as { id: string }).id)
  } else {
    await admin.schema("growth").from("campaign_revenue_attribution_snapshots").insert(row)
  }

  if (demoRequests > 0) {
    await recordRevenueAttributionEvent(admin, {
      leadId: input.leadId,
      eventType: "demo_request_detected",
      sequenceEnrollmentId: input.sequenceEnrollmentId,
      metadata: { signal_count: demoRequests, source: "reply_v2" },
    }).catch(() => undefined)
  }
  if (pricingQuestions > 0) {
    await recordRevenueAttributionEvent(admin, {
      leadId: input.leadId,
      eventType: "pricing_question_detected",
      sequenceEnrollmentId: input.sequenceEnrollmentId,
      metadata: { source: "reply_v2" },
    }).catch(() => undefined)
  }
  if (positiveReplies > 0) {
    await recordRevenueAttributionEvent(admin, {
      leadId: input.leadId,
      eventType: "positive_reply_detected",
      sequenceEnrollmentId: input.sequenceEnrollmentId,
      metadata: { intent: input.classification.intent },
    }).catch(() => undefined)
  }
}
