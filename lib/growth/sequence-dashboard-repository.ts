import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequencePatternOutcome } from "@/lib/growth/sequence-types"
import { computeSequenceEffectivenessMetrics } from "@/lib/growth/sequence/sequence-effectiveness-score"
import { evaluateSequenceOutcome } from "@/lib/growth/sequence/sequence-outcome-evaluator"
import { matchPatternTouches } from "@/lib/growth/sequence/sequence-pattern-matcher"
import {
  listGrowthSequencePatterns,
  upsertGrowthSequencePatternMetrics,
} from "@/lib/growth/sequence-pattern-repository"
import type { GrowthSequenceFatigueRisk } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

const TERMINAL = new Set(["converted", "disqualified", "archived"])

function performanceScore(pattern: {
  positiveReplyRate: number
  meetingSignalRate: number
  sequenceQualityScore: number
  confidenceScore: number
}): number {
  return (
    pattern.positiveReplyRate * 35 +
    pattern.meetingSignalRate * 25 +
    pattern.sequenceQualityScore * 0.25 +
    pattern.confidenceScore * 0.15
  )
}

export async function refreshGrowthSequencePatternMetrics(admin: SupabaseClient): Promise<void> {
  const patterns = await listGrowthSequencePatterns(admin)
  if (patterns.length === 0) return

  const { data: outcomes, error } = await admin
    .schema("growth")
    .from("sequence_pattern_outcomes")
    .select("*")

  if (error) throw new Error(error.message)

  const grouped = new Map<string, GrowthSequencePatternOutcome[]>()
  for (const row of outcomes ?? []) {
    const outcome: GrowthSequencePatternOutcome = {
      patternId: row.pattern_id as string,
      leadId: row.lead_id as string,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string | null) ?? null,
      gotReply: Boolean(row.got_reply),
      gotPositiveReply: Boolean(row.got_positive_reply),
      gotMeetingSignal: Boolean(row.got_meeting_signal),
      followUpCompleted: Boolean(row.follow_up_completed),
      abandoned: Boolean(row.abandoned),
      timeToReplyHours: row.time_to_reply_hours as number | null,
      touchesToPositiveSignal: row.touches_to_positive_signal as number | null,
      opportunityScoreBefore: row.opportunity_score_before as number | null,
      opportunityScoreAfter: row.opportunity_score_after as number | null,
      revenueProbabilityBefore: row.revenue_probability_before as number | null,
      revenueProbabilityAfter: row.revenue_probability_after as number | null,
      conversationHealthBefore: row.conversation_health_before as number | null,
      conversationHealthAfter: row.conversation_health_after as number | null,
      leadIndustryBucket: row.lead_industry_bucket as string | null,
      dominantObjectionKey: row.dominant_objection_key as string | null,
      buyingIntentAtStart: row.buying_intent_at_start as string | null,
    }
    const list = grouped.get(outcome.patternId) ?? []
    list.push(outcome)
    grouped.set(outcome.patternId, list)
  }

  for (const pattern of patterns) {
    const metrics = computeSequenceEffectivenessMetrics(grouped.get(pattern.id) ?? [])
    await upsertGrowthSequencePatternMetrics(admin, pattern.id, metrics)
  }
}

export async function fetchGrowthSequenceDashboard(admin: SupabaseClient) {
  await refreshGrowthSequencePatternMetrics(admin)
  const patterns = await listGrowthSequencePatterns(admin)

  const sorted = [...patterns].sort((a, b) => performanceScore(b) - performanceScore(a))
  const withAttempts = sorted.filter((pattern) => pattern.attemptCount > 0)
  const topPerforming = withAttempts.slice(0, 8)
  const underperforming = [...withAttempts]
    .sort((a, b) => performanceScore(a) - performanceScore(b))
    .slice(0, 8)

  const sequenceRiskWatch = patterns.filter(
    (pattern) =>
      pattern.sequenceFatigueRisk === "high" ||
      pattern.sequenceAbandonmentRate >= 0.35 ||
      pattern.sequenceQualityScore <= 35,
  )

  const { data: leads, error } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, status, score, recommended_sequence_pattern_id, recommended_sequence_reason, recommended_sequence_confidence, sequence_fatigue_risk, recommended_sequence_next_step, executive_priority_tier, relationship_strength_tier, conversation_buying_intent, field_service_stack_detected, crm_detected",
    )
    .not("status", "in", '("converted","disqualified","archived")')
    .not("recommended_sequence_pattern_id", "is", null)
    .order("recommended_sequence_confidence", { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw new Error(error.message)

  const recommendedNext = (leads ?? [])
    .filter((row) => !TERMINAL.has(row.status as string))
    .map((row) => ({
      id: row.id as string,
      companyName: row.company_name as string,
      contactName: (row.contact_name as string | null) ?? null,
      recommendedSequenceConfidence: row.recommended_sequence_confidence as number | null,
      recommendedSequenceReason: row.recommended_sequence_reason as string | null,
      sequenceFatigueRisk: row.sequence_fatigue_risk as GrowthSequenceFatigueRisk | null,
    }))

  const { data: outcomeRows } = await admin.schema("growth").from("sequence_pattern_outcomes").select("*")

  const byIndustry = new Map<string, { count: number; positive: number; patternKey: string }>()
  const byObjection = new Map<string, { count: number; positive: number; patternKey: string }>()
  const byBuyingIntent = new Map<string, { count: number; positive: number; patternKey: string }>()

  for (const row of outcomeRows ?? []) {
    const pattern = patterns.find((entry) => entry.id === row.pattern_id)
    if (!pattern) continue
    const positive = Boolean(row.got_positive_reply)

    for (const [map, key] of [
      [byIndustry, (row.lead_industry_bucket as string | null) ?? "general"],
      [byObjection, (row.dominant_objection_key as string | null) ?? "none"],
      [byBuyingIntent, (row.buying_intent_at_start as string | null) ?? "none"],
    ] as const) {
      const bucket = map.get(key) ?? { count: 0, positive: 0, patternKey: pattern.key }
      bucket.count += 1
      if (positive) bucket.positive += 1
      if (positive / bucket.count > bucket.positive / Math.max(bucket.count - 1, 1)) {
        bucket.patternKey = pattern.key
      }
      map.set(key, bucket)
    }
  }

  const mapBest = (entries: Map<string, { count: number; positive: number; patternKey: string }>) =>
    [...entries.entries()]
      .filter(([, value]) => value.count >= 1)
      .map(([segment, value]) => ({
        segment,
        patternKey: value.patternKey,
        positiveRate: value.count > 0 ? value.positive / value.count : 0,
        count: value.count,
      }))
      .sort((a, b) => b.positiveRate - a.positiveRate)
      .slice(0, 8)

  return {
    averageQuality:
      patterns.length > 0
        ? Math.round(
            patterns.reduce((sum, pattern) => sum + pattern.sequenceQualityScore, 0) / patterns.length,
          )
        : 0,
    topPerforming,
    underperforming,
    sequenceRiskWatch,
    bestByIndustry: mapBest(byIndustry),
    bestByObjection: mapBest(byObjection),
    bestByBuyingIntent: mapBest(byBuyingIntent),
    recommendedNextSequences: recommendedNext,
    sequenceLiftTrends: patterns.map((pattern) => ({
      key: pattern.key,
      label: pattern.label,
      opportunityLift: pattern.opportunityLift,
      revenueProbabilityLift: pattern.revenueProbabilityLift,
      conversationHealthLift: pattern.conversationHealthLift,
      qualityScore: pattern.sequenceQualityScore,
    })),
  }
}

export async function detectAndPersistLeadSequenceOutcomes(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<void> {
  const patterns = await listGrowthSequencePatterns(admin)
  const { fetchGrowthSequenceTouchTimeline } = await import("@/lib/growth/sequence-pattern-repository")
  const touches = await fetchGrowthSequenceTouchTimeline(admin, lead)

  for (const pattern of patterns) {
    const stepDefs = pattern.steps.map((step) => ({
      channel: step.channel,
      delayDaysMin: step.delayDaysMin,
      delayDaysMax: step.delayDaysMax,
      generationType: step.generationType,
    }))
    const matches = matchPatternTouches(touches, stepDefs)
    for (const matched of matches) {
      const outcome = evaluateSequenceOutcome({
        patternId: pattern.id,
        leadId: lead.id,
        matchedTouches: matched,
        allTouches: touches,
        outcomeWindowDays: pattern.maxObservationDays,
        opportunityScoreBefore: lead.opportunityReadinessPreviousScore ?? lead.opportunityReadinessScore,
        opportunityScoreAfter: lead.opportunityReadinessScore,
        revenueProbabilityBefore: lead.revenueProbabilityPreviousScore ?? lead.revenueProbabilityScore,
        revenueProbabilityAfter: lead.revenueProbabilityScore,
        conversationHealthBefore: lead.conversationPreviousScore ?? lead.conversationHealthScore,
        conversationHealthAfter: lead.conversationHealthScore,
        leadIndustryBucket: lead.fieldServiceStackDetected ?? lead.crmDetected ?? "general",
        dominantObjectionKey: lead.conversationObjectionProfile?.clusters?.[0]?.key ?? null,
        buyingIntentAtStart: lead.conversationBuyingIntent,
        stepCount: pattern.steps.length,
      })

      await admin.schema("growth").from("sequence_pattern_outcomes").upsert(
        {
          pattern_id: outcome.patternId,
          lead_id: outcome.leadId,
          started_at: outcome.startedAt,
          completed_at: outcome.completedAt,
          got_reply: outcome.gotReply,
          got_positive_reply: outcome.gotPositiveReply,
          got_meeting_signal: outcome.gotMeetingSignal,
          follow_up_completed: outcome.followUpCompleted,
          abandoned: outcome.abandoned,
          time_to_reply_hours: outcome.timeToReplyHours,
          touches_to_positive_signal: outcome.touchesToPositiveSignal,
          opportunity_score_before: outcome.opportunityScoreBefore,
          opportunity_score_after: outcome.opportunityScoreAfter,
          revenue_probability_before: outcome.revenueProbabilityBefore,
          revenue_probability_after: outcome.revenueProbabilityAfter,
          conversation_health_before: outcome.conversationHealthBefore,
          conversation_health_after: outcome.conversationHealthAfter,
          lead_industry_bucket: outcome.leadIndustryBucket,
          dominant_objection_key: outcome.dominantObjectionKey,
          buying_intent_at_start: outcome.buyingIntentAtStart,
        },
        { onConflict: "pattern_id,lead_id,started_at" },
      )
    }
  }
}
