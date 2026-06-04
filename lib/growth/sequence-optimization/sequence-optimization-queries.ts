import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadOutreachPerformanceAttributedSends } from "@/lib/growth/outreach/performance/performance-dashboard-repository"
import type { OutreachPerformanceAttributedSend } from "@/lib/growth/outreach/performance/performance-types"
import { computeGlobalChannelEffectiveness } from "@/lib/growth/revenue-intelligence/channel-effectiveness-analytics"
import { loadSequenceSnapshotHints } from "@/lib/growth/revenue-attribution/attribution-recommendation-queries"
import type { GrowthRevenueAttributionDashboardFilters } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

type Row = Record<string, unknown>

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function ratePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function aggregateCopySignals(
  rows: OutreachPerformanceAttributedSend[],
  pickKey: (row: OutreachPerformanceAttributedSend) => string,
  labelFn: (key: string) => string,
): Array<{ key: string; label: string; sends: number; replyRatePct: number | null }> {
  const buckets = new Map<string, { sends: number; replies: number }>()
  for (const row of rows) {
    const key = pickKey(row)
    const bucket = buckets.get(key) ?? { sends: 0, replies: 0 }
    bucket.sends += 1
    if (row.replied) bucket.replies += 1
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: labelFn(key),
      sends: bucket.sends,
      replyRatePct: ratePct(bucket.replies, bucket.sends),
    }))
    .filter((row) => row.sends >= 3)
    .sort((a, b) => (b.replyRatePct ?? 0) - (a.replyRatePct ?? 0))
}

export async function loadSequenceOptimizationOutreachSignals(
  admin: SupabaseClient,
  filters: GrowthRevenueAttributionDashboardFilters,
): Promise<{
  subjectSignals: Array<{ key: string; label: string; sends: number; replyRatePct: number | null }>
  openerSignals: Array<{ key: string; label: string; sends: number; replyRatePct: number | null }>
  ctaSignals: Array<{ key: string; label: string; sends: number; wins: number }>
}> {
  const sinceMs = Date.parse(filters.dateFrom)
  const toMs = Date.parse(filters.dateTo)
  const windowDays = Math.max(7, Math.min(90, Math.ceil((toMs - sinceMs) / 86400000)))
  const rows = (await loadOutreachPerformanceAttributedSends(admin, { measurementWindowDays: windowDays }).catch(
    () => [],
  )).filter((row) => {
    const recorded = Date.parse(row.recordedAt)
    return recorded >= sinceMs && recorded <= toMs && row.sent
  })

  const subjectSignals = aggregateCopySignals(
    rows,
    (row) => row.subjectCategory,
    (key) => `Subject: ${key}`,
  )
  const openerSignals = aggregateCopySignals(
    rows,
    (row) => row.openerStrategyKey,
    (key) => `Opener: ${key}`,
  )

  const ctaBuckets = new Map<string, { sends: number; wins: number }>()
  for (const row of rows) {
    const key = row.ctaCategory
    const bucket = ctaBuckets.get(key) ?? { sends: 0, wins: 0 }
    bucket.sends += 1
    if (row.meetingBooked || row.opportunitiesCreated || row.positiveInterest) bucket.wins += 1
    ctaBuckets.set(key, bucket)
  }
  const ctaSignals = [...ctaBuckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: `CTA: ${key}`,
      sends: bucket.sends,
      wins: bucket.wins,
    }))
    .filter((row) => row.sends >= 3)
    .sort((a, b) => b.wins - a.wins || b.sends - a.sends)

  return { subjectSignals, openerSignals, ctaSignals }
}

export async function loadSequenceStepMetadata(
  admin: SupabaseClient,
  sequenceIds?: string[],
): Promise<
  Array<{
    stepId: string
    sequenceId: string
    stepOrder: number
    channel: string
    delayDaysMin: number
    delayDaysMax: number
  }>
> {
  let query = admin
    .schema("growth")
    .from("sequence_pattern_steps")
    .select("id, sequence_pattern_id, step_order, channel, delay_days_min, delay_days_max")
    .limit(2000)

  if (sequenceIds && sequenceIds.length > 0) {
    query = query.in("sequence_pattern_id", sequenceIds)
  }

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row) => {
    const r = row as Row
    return {
      stepId: String(r.id),
      sequenceId: String(r.sequence_pattern_id),
      stepOrder: Number(r.step_order ?? 0),
      channel: String(r.channel ?? "email"),
      delayDaysMin: Number(r.delay_days_min ?? 0),
      delayDaysMax: Number(r.delay_days_max ?? 0),
    }
  })
}

export async function loadReplyQualityBySequence(
  admin: SupabaseClient,
): Promise<
  Array<{
    sequenceId: string
    replyQualityScore: number
    objectionRate: number
    positiveReplyRate: number
    totalReplies: number
  }>
> {
  const since = daysAgoIso(30)
  const { data: snapshots, error } = await admin
    .schema("growth")
    .from("campaign_reply_learning_snapshots")
    .select("sequence_enrollment_id, total_replies, positive_reply_rate, objection_rate, reply_quality_score")
    .gte("snapshot_date", since.slice(0, 10))
    .not("sequence_enrollment_id", "is", null)
    .limit(500)
  if (error) return []

  const enrollmentIds = [
    ...new Set(
      (snapshots ?? [])
        .map((row) => (row as Row).sequence_enrollment_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]
  if (enrollmentIds.length === 0) return []

  const { data: enrollments } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, sequence_pattern_id")
    .in("id", enrollmentIds.slice(0, 200))

  const patternByEnrollment = new Map<string, string>()
  for (const row of enrollments ?? []) {
    const r = row as Row
    if (r.sequence_pattern_id) patternByEnrollment.set(String(r.id), String(r.sequence_pattern_id))
  }

  const buckets = new Map<
    string,
    { totalReplies: number; qualitySum: number; positiveSum: number; objectionSum: number; count: number }
  >()

  for (const row of snapshots ?? []) {
    const r = row as Row
    const enrollmentId = r.sequence_enrollment_id ? String(r.sequence_enrollment_id) : ""
    const sequenceId = patternByEnrollment.get(enrollmentId)
    if (!sequenceId) continue
    const bucket = buckets.get(sequenceId) ?? {
      totalReplies: 0,
      qualitySum: 0,
      positiveSum: 0,
      objectionSum: 0,
      count: 0,
    }
    bucket.totalReplies += Number(r.total_replies ?? 0)
    bucket.qualitySum += Number(r.reply_quality_score ?? 0)
    bucket.positiveSum += Number(r.positive_reply_rate ?? 0)
    bucket.objectionSum += Number(r.objection_rate ?? 0)
    bucket.count += 1
    buckets.set(sequenceId, bucket)
  }

  return [...buckets.entries()].map(([sequenceId, bucket]) => ({
    sequenceId,
    replyQualityScore: bucket.count > 0 ? Math.round(bucket.qualitySum / bucket.count) : 0,
    positiveReplyRate: bucket.count > 0 ? Math.round(bucket.positiveSum / bucket.count) : 0,
    objectionRate: bucket.count > 0 ? Math.round(bucket.objectionSum / bucket.count) : 0,
    totalReplies: bucket.totalReplies,
  }))
}

export async function loadSequenceOptimizationSignals(
  admin: SupabaseClient,
  filters: GrowthRevenueAttributionDashboardFilters,
): Promise<{
  sequenceSnapshots: Awaited<ReturnType<typeof loadSequenceSnapshotHints>>
  outreach: Awaited<ReturnType<typeof loadSequenceOptimizationOutreachSignals>>
  stepMeta: Awaited<ReturnType<typeof loadSequenceStepMetadata>>
  channelEffectiveness: Awaited<ReturnType<typeof computeGlobalChannelEffectiveness>>
  replyQualityBySequence: Awaited<ReturnType<typeof loadReplyQualityBySequence>>
}> {
  const [sequenceSnapshots, outreach, channelEffectiveness, replyQualityBySequence] = await Promise.all([
    loadSequenceSnapshotHints(admin),
    loadSequenceOptimizationOutreachSignals(admin, filters),
    computeGlobalChannelEffectiveness(admin).catch(() => []),
    loadReplyQualityBySequence(admin),
  ])

  const stepMeta = await loadSequenceStepMetadata(admin)

  return { sequenceSnapshots, outreach, stepMeta, channelEffectiveness, replyQualityBySequence }
}
