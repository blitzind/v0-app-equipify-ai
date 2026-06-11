import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequencePattern,
  GrowthSequencePatternStep,
  GrowthSequenceTouch,
} from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

type PatternRow = {
  id: string
  key: string
  label: string
  description: string | null
  pattern_kind: string
  sequence_version: number
  is_active: boolean
  metadata?: Record<string, unknown> | null
  min_touches: number
  max_observation_days: number
  attempt_count: number
  reply_rate: number
  positive_reply_rate: number
  meeting_signal_rate: number
  follow_up_completion_rate: number
  sequence_abandonment_rate: number
  opportunity_lift: number
  revenue_probability_lift: number
  conversation_health_lift: number
  average_time_to_reply_hours: number | null
  average_touches_to_positive_signal: number | null
  sequence_quality_score: number
  sequence_fatigue_risk: string
  confidence_score: number
  computed_at: string | null
}

type StepRow = {
  id: string
  pattern_id: string
  step_order: number
  channel: string
  delay_days_min: number
  delay_days_max: number
  generation_type: string | null
  playbook_category: string | null
  voice_drop_campaign_id: string | null
  required_human_approval: boolean
  expected_signal: string
}

function mapStep(row: StepRow): GrowthSequencePatternStep {
  return {
    id: row.id,
    patternId: row.pattern_id,
    stepOrder: row.step_order,
    channel: row.channel as GrowthSequencePatternStep["channel"],
    delayDaysMin: row.delay_days_min,
    delayDaysMax: row.delay_days_max,
    generationType: row.generation_type,
    playbookCategory: row.playbook_category,
    voiceDropCampaignId: row.voice_drop_campaign_id ?? null,
    requiredHumanApproval: row.required_human_approval,
    expectedSignal: row.expected_signal as GrowthSequencePatternStep["expectedSignal"],
  }
}

function mapPattern(row: PatternRow, steps: GrowthSequencePatternStep[]): GrowthSequencePattern {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    patternKind: row.pattern_kind as GrowthSequencePattern["patternKind"],
    sequenceVersion: row.sequence_version,
    isActive: row.is_active,
    minTouches: row.min_touches,
    maxObservationDays: row.max_observation_days,
    attemptCount: row.attempt_count,
    replyRate: Number(row.reply_rate),
    positiveReplyRate: Number(row.positive_reply_rate),
    meetingSignalRate: Number(row.meeting_signal_rate),
    followUpCompletionRate: Number(row.follow_up_completion_rate),
    sequenceAbandonmentRate: Number(row.sequence_abandonment_rate),
    opportunityLift: Number(row.opportunity_lift),
    revenueProbabilityLift: Number(row.revenue_probability_lift),
    conversationHealthLift: Number(row.conversation_health_lift),
    averageTimeToReplyHours: row.average_time_to_reply_hours,
    averageTouchesToPositiveSignal: row.average_touches_to_positive_signal,
    sequenceQualityScore: row.sequence_quality_score,
    sequenceFatigueRisk: row.sequence_fatigue_risk as GrowthSequencePattern["sequenceFatigueRisk"],
    confidenceScore: row.confidence_score,
    computedAt: row.computed_at,
    steps,
  }
}

function metadataAllowsApolloMaterialization(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const record = metadata as Record<string, unknown>
  return record.apollo_materialization_allowed === true || record.certification_only === true
}

async function fetchGrowthSequencePatternRowByKey(
  admin: SupabaseClient,
  key: string,
): Promise<PatternRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("*")
    .eq("key", key)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as PatternRow) : null
}

export async function fetchGrowthSequencePatternByKeyForApolloMaterialization(
  admin: SupabaseClient,
  key: string,
): Promise<GrowthSequencePattern | null> {
  const row = await fetchGrowthSequencePatternRowByKey(admin, key)
  if (!row) return null

  const apolloAllowed = row.is_active || metadataAllowsApolloMaterialization(row.metadata)
  if (!apolloAllowed) return null

  const { data: steps, error: stepsError } = await admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .select("*")
    .eq("pattern_id", row.id)
    .order("step_order", { ascending: true })

  if (stepsError) throw new Error(stepsError.message)

  return mapPattern(row, ((steps ?? []) as StepRow[]).map(mapStep))
}

export async function listGrowthSequencePatterns(admin: SupabaseClient): Promise<GrowthSequencePattern[]> {
  const { data: patterns, error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("*")
    .eq("is_active", true)
    .order("sequence_quality_score", { ascending: false })

  if (error) throw new Error(error.message)
  if (!patterns?.length) return []

  const patternIds = patterns.map((row) => row.id as string)
  const { data: steps, error: stepsError } = await admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .select("*")
    .in("pattern_id", patternIds)
    .order("step_order", { ascending: true })

  if (stepsError) throw new Error(stepsError.message)

  const stepsByPattern = new Map<string, GrowthSequencePatternStep[]>()
  for (const row of (steps ?? []) as StepRow[]) {
    const list = stepsByPattern.get(row.pattern_id) ?? []
    list.push(mapStep(row))
    stepsByPattern.set(row.pattern_id, list)
  }

  return (patterns as PatternRow[]).map((row) => mapPattern(row, stepsByPattern.get(row.id) ?? []))
}

export async function fetchGrowthSequenceTouchTimeline(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthSequenceTouch[]> {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const touches: GrowthSequenceTouch[] = []

  const { data: queueItems } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id, channel, executed_at, payload_snapshot")
    .eq("lead_id", lead.id)
    .eq("status", "executed")
    .gte("executed_at", since)
    .order("executed_at", { ascending: true })

  for (const row of queueItems ?? []) {
    const payload = (row.payload_snapshot ?? {}) as { generationType?: string | null }
    touches.push({
      occurredAt: row.executed_at as string,
      channel: row.channel as GrowthSequenceTouch["channel"],
      generationType: payload.generationType ?? null,
      queueId: row.id as string,
    })
  }

  const { data: replies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("received_at, classification")
    .eq("lead_id", lead.id)
    .gte("received_at", since)
    .order("received_at", { ascending: true })

  for (const row of replies ?? []) {
    touches.push({
      occurredAt: row.received_at as string,
      channel: "reply",
      generationType: row.classification as string,
      signalKind: row.classification as string,
    })
  }

  const { data: callEvents } = await admin
    .schema("growth")
    .from("lead_call_events")
    .select("id, disposition, created_at")
    .eq("lead_id", lead.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true })

  for (const row of callEvents ?? []) {
    touches.push({
      occurredAt: row.created_at as string,
      channel: "manual_call",
      generationType: null,
      callEventId: row.id as string,
      signalKind: `call_${row.disposition as string}`,
    })
  }

  const { data: smsAttempts } = await admin
    .schema("growth")
    .from("sms_delivery_attempts")
    .select("id, queued_at, status")
    .eq("lead_id", lead.id)
    .gte("queued_at", since)
    .order("queued_at", { ascending: true })

  for (const row of smsAttempts ?? []) {
    touches.push({
      occurredAt: (row.queued_at as string) ?? (row as { created_at?: string }).created_at ?? since,
      channel: "sms",
      generationType: null,
      messageId: row.id as string,
      signalKind: row.status as string,
    })
  }

  const { data: channelEvents } = await admin
    .schema("growth")
    .from("sequence_enrollment_channel_events")
    .select("channel, event_kind, title, occurred_at, enrollment_step_id")
    .eq("lead_id", lead.id)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true })

  for (const row of channelEvents ?? []) {
    touches.push({
      occurredAt: row.occurred_at as string,
      channel: row.channel as GrowthSequenceTouch["channel"],
      generationType: null,
      signalKind: row.event_kind as string,
      queueId: row.enrollment_step_id as string | null,
    })
  }

  return touches.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
}

export async function updateGrowthSequencePatternStepVoiceDropCampaign(
  admin: SupabaseClient,
  input: {
    patternId: string
    stepId: string
    voiceDropCampaignId: string | null
  },
): Promise<GrowthSequencePatternStep> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .update({
      voice_drop_campaign_id: input.voiceDropCampaignId,
    })
    .eq("id", input.stepId)
    .eq("pattern_id", input.patternId)
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("step_not_found")

  return {
    id: data.id as string,
    patternId: data.pattern_id as string,
    stepOrder: data.step_order as number,
    channel: data.channel as GrowthSequencePatternStep["channel"],
    delayDaysMin: data.delay_days_min as number,
    delayDaysMax: data.delay_days_max as number,
    generationType: (data.generation_type as string | null) ?? null,
    playbookCategory: (data.playbook_category as string | null) ?? null,
    voiceDropCampaignId: (data.voice_drop_campaign_id as string | null) ?? null,
    requiredHumanApproval: Boolean(data.required_human_approval),
    expectedSignal: data.expected_signal as GrowthSequencePatternStep["expectedSignal"],
  }
}

export async function setGrowthSequencePatternActive(
  admin: SupabaseClient,
  input: { patternId: string; isActive: boolean },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .update({ is_active: input.isActive, updated_at: new Date().toISOString() })
    .eq("id", input.patternId)
  if (error) throw new Error(error.message)
}

export async function upsertGrowthSequencePatternMetrics(
  admin: SupabaseClient,
  patternId: string,
  metrics: {
    attemptCount: number
    replyRate: number
    positiveReplyRate: number
    meetingSignalRate: number
    followUpCompletionRate: number
    sequenceAbandonmentRate: number
    opportunityLift: number
    revenueProbabilityLift: number
    conversationHealthLift: number
    averageTimeToReplyHours: number | null
    averageTouchesToPositiveSignal: number | null
    sequenceQualityScore: number
    sequenceFatigueRisk: string
    confidenceScore: number
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .update({
      attempt_count: metrics.attemptCount,
      reply_rate: metrics.replyRate,
      positive_reply_rate: metrics.positiveReplyRate,
      meeting_signal_rate: metrics.meetingSignalRate,
      follow_up_completion_rate: metrics.followUpCompletionRate,
      sequence_abandonment_rate: metrics.sequenceAbandonmentRate,
      opportunity_lift: metrics.opportunityLift,
      revenue_probability_lift: metrics.revenueProbabilityLift,
      conversation_health_lift: metrics.conversationHealthLift,
      average_time_to_reply_hours: metrics.averageTimeToReplyHours,
      average_touches_to_positive_signal: metrics.averageTouchesToPositiveSignal,
      sequence_quality_score: metrics.sequenceQualityScore,
      sequence_fatigue_risk: metrics.sequenceFatigueRisk,
      confidence_score: metrics.confidenceScore,
      computed_at: new Date().toISOString(),
    })
    .eq("id", patternId)

  if (error) throw new Error(error.message)
}
