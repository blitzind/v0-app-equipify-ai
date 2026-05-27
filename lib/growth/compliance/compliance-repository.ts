import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyBounce, hashComplianceEmail, isHardBounceType } from "@/lib/growth/compliance/bounce-classifier"
import { recordExperimentMetricFromDeliveryAttempt } from "@/lib/growth/experiments/experiment-metrics"
import {
  recordBounceDetectedTimelineEvent,
  recordSenderReputationDeclinedTimelineEvent,
} from "@/lib/growth/compliance/compliance-events"
import type {
  GrowthComplianceDashboard,
  GrowthDeliverySuppressionRecord,
  GrowthEmailBounceRecord,
  GrowthEmailComplaintRecord,
  GrowthLeadComplianceDetail,
  GrowthUnsubscribeRecord,
} from "@/lib/growth/compliance/compliance-types"
import { GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER } from "@/lib/growth/compliance/compliance-types"
import { buildSenderReputationSnapshot } from "@/lib/growth/compliance/sender-reputation"
import { applyDeliverySuppression } from "@/lib/growth/compliance/suppression-engine"
import { getDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"

type BounceRow = {
  id: string
  delivery_attempt_id: string
  lead_id: string | null
  sender_account_id: string
  provider_id: string
  bounce_type: string
  provider_code: string | null
  provider_reason: string | null
  occurred_at: string
  retry_allowed: boolean
}

type ComplaintRow = {
  id: string
  delivery_attempt_id: string
  lead_id: string | null
  sender_account_id: string
  provider_id: string
  complaint_type: string
  provider_reason: string | null
  occurred_at: string
}

type SuppressionRow = {
  id: string
  lead_id: string | null
  email_hash: string
  reason: string
  active: boolean
  expires_at: string | null
  created_at: string
}

type UnsubscribeRow = {
  id: string
  email_hash: string
  scope: string
  organization_id: string | null
  reason: string | null
  source: string
  occurred_at: string
}

function bouncesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_bounces")
}

function complaintsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_complaints")
}

function suppressionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_suppressions")
}

function unsubscribesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("unsubscribe_registry")
}

function mapBounce(row: BounceRow): GrowthEmailBounceRecord {
  return {
    id: row.id,
    deliveryAttemptId: row.delivery_attempt_id,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    providerId: row.provider_id,
    bounceType: row.bounce_type as GrowthEmailBounceRecord["bounceType"],
    providerCode: row.provider_code,
    providerReason: row.provider_reason,
    occurredAt: row.occurred_at,
    retryAllowed: row.retry_allowed,
  }
}

function mapComplaint(row: ComplaintRow): GrowthEmailComplaintRecord {
  return {
    id: row.id,
    deliveryAttemptId: row.delivery_attempt_id,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    providerId: row.provider_id,
    complaintType: row.complaint_type as GrowthEmailComplaintRecord["complaintType"],
    providerReason: row.provider_reason,
    occurredAt: row.occurred_at,
  }
}

function mapSuppression(row: SuppressionRow): GrowthDeliverySuppressionRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    emailHash: row.email_hash,
    reason: row.reason,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function mapUnsubscribe(row: UnsubscribeRow): GrowthUnsubscribeRecord {
  return {
    id: row.id,
    emailHash: row.email_hash,
    scope: row.scope as GrowthUnsubscribeRecord["scope"],
    organizationId: row.organization_id,
    reason: row.reason,
    source: row.source,
    occurredAt: row.occurred_at,
  }
}

export async function recordEmailBounce(
  admin: SupabaseClient,
  input: {
    deliveryAttemptId: string
    providerCode?: string | null
    providerReason?: string | null
    bounceTypeHint?: string | null
    recipientEmail?: string | null
    occurredAt?: string
  },
): Promise<{ recorded: boolean; classification: ReturnType<typeof classifyBounce> }> {
  const attempt = await getDeliveryAttempt(admin, input.deliveryAttemptId)
  if (!attempt) return { recorded: false, classification: classifyBounce({}) }

  const classification = classifyBounce({
    providerCode: input.providerCode,
    providerReason: input.providerReason,
    bounceTypeHint: input.bounceTypeHint,
  })

  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const sanitizedReason = input.providerReason?.slice(0, 500) ?? null
  const sanitizedCode = input.providerCode?.slice(0, 120) ?? null

  const { error } = await bouncesTable(admin).insert({
    delivery_attempt_id: attempt.id,
    lead_id: attempt.lead_id,
    sender_account_id: attempt.sender_account_id,
    provider_id: attempt.provider_id,
    bounce_type: classification.bounceType,
    provider_code: sanitizedCode,
    provider_reason: sanitizedReason,
    occurred_at: occurredAt,
    retry_allowed: classification.retryAllowed,
  })

  if (error) throw new Error(error.message)

  const recipientEmail =
    input.recipientEmail ?? (typeof attempt.metadata.to === "string" ? attempt.metadata.to : null)

  if (classification.shouldSuppress && recipientEmail) {
    await applyDeliverySuppression(admin, {
      email: recipientEmail,
      leadId: attempt.lead_id,
      reason: `Hard bounce (${classification.bounceType})`,
    })
  }

  if (attempt.lead_id) {
    await recordBounceDetectedTimelineEvent(admin, {
      leadId: attempt.lead_id,
      bounceType: classification.bounceType,
      deliveryAttemptId: attempt.id,
      summary: classification.summary,
      occurredAt,
    })
  }

  if (isHardBounceType(classification.bounceType)) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count: hardCount } = await bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", attempt.sender_account_id)
      .in("bounce_type", ["hard", "blocked", "spam"])
      .gte("occurred_at", since30d)

    const snapshot = buildSenderReputationSnapshot({
      hardBounces: hardCount ?? 0,
      softBounces: 0,
      complaints: 0,
      spamEvents: 0,
      cleanDays: 0,
    })

    if (snapshot.tier !== "healthy") {
      await recordSenderReputationDeclinedTimelineEvent(admin, {
        leadId: attempt.lead_id,
        senderAccountId: attempt.sender_account_id,
        score: snapshot.score,
        tier: snapshot.tier,
      })
    }
  }

  await recordExperimentMetricFromDeliveryAttempt(admin, {
    deliveryAttemptId: attempt.id,
    metric: "bounces",
  }).catch(() => undefined)

  const { recordPerformanceEngagementFromDeliveryAttempt } = await import(
    "@/lib/growth/revenue-intelligence/performance-snapshots"
  )
  await recordPerformanceEngagementFromDeliveryAttempt(admin, {
    deliveryAttemptId: attempt.id,
    metric: "bounces",
  }).catch(() => undefined)

  return { recorded: true, classification }
}

async function computeAggregateSenderReputation(admin: SupabaseClient) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [hardRes, softRes, complaintRes, spamRes, sentRes] = await Promise.all([
    bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .in("bounce_type", ["hard", "blocked"])
      .gte("occurred_at", since30d),
    bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .in("bounce_type", ["soft", "transient"])
      .gte("occurred_at", since30d),
    complaintsTable(admin).select("id", { count: "exact", head: true }).gte("occurred_at", since30d),
    bouncesTable(admin).select("id", { count: "exact", head: true }).eq("bounce_type", "spam").gte("occurred_at", since30d),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", since30d),
  ])

  const sentCount = sentRes.count ?? 0
  const hardCount = hardRes.count ?? 0
  const complaintCount = complaintRes.count ?? 0

  const cleanDays = hardCount === 0 && complaintCount === 0 ? 7 : 0

  return {
    reputation: buildSenderReputationSnapshot({
      hardBounces: hardCount,
      softBounces: softRes.count ?? 0,
      complaints: complaintCount,
      spamEvents: spamRes.count ?? 0,
      cleanDays,
    }),
    sentCount,
    hardCount,
    complaintCount,
  }
}

export async function fetchComplianceDashboard(admin: SupabaseClient): Promise<GrowthComplianceDashboard> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { reputation, sentCount, hardCount, complaintCount } = await computeAggregateSenderReputation(admin)

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0

  const [suppRes, bounceRows, complaintRows] = await Promise.all([
    suppressionsTable(admin).select("*").eq("active", true).order("created_at", { ascending: false }).limit(50),
    bouncesTable(admin).select("*").order("occurred_at", { ascending: false }).limit(20),
    complaintsTable(admin).select("*").order("occurred_at", { ascending: false }).limit(20),
  ])

  if (suppRes.error) throw new Error(suppRes.error.message)
  if (bounceRows.error) throw new Error(bounceRows.error.message)
  if (complaintRows.error) throw new Error(complaintRows.error.message)

  const senderIds = new Set<string>()
  const providerIds = new Set<string>()
  for (const row of [...(bounceRows.data ?? []), ...(complaintRows.data ?? [])]) {
    senderIds.add(row.sender_account_id as string)
    providerIds.add(row.provider_id as string)
  }

  const [senders, providers] = await Promise.all([
    senderIds.size > 0
      ? admin.schema("growth").from("sender_accounts").select("id, email_address, display_name").in("id", [...senderIds])
      : Promise.resolve({ data: [] }),
    providerIds.size > 0
      ? admin.schema("growth").from("delivery_providers").select("id, provider_name").in("id", [...providerIds])
      : Promise.resolve({ data: [] }),
  ])

  const senderMap = new Map(
    (senders.data ?? []).map((row) => [
      row.id as string,
      (row.display_name as string | null) || (row.email_address as string),
    ]),
  )
  const providerMap = new Map((providers.data ?? []).map((row) => [row.id as string, row.provider_name as string]))

  return {
    qa_marker: GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
    hardBounceRate: rate(hardCount, sentCount),
    complaintRate: rate(complaintCount, sentCount),
    suppressionCount: (suppRes.data ?? []).length,
    senderReputation: reputation,
    suppressions: (suppRes.data ?? []).map((row) => mapSuppression(row as SuppressionRow)),
    recentBounces: (bounceRows.data ?? []).map((row) => ({
      ...mapBounce(row as BounceRow),
      senderLabel: senderMap.get(row.sender_account_id as string) ?? "Sender",
      providerLabel: providerMap.get(row.provider_id as string) ?? "Provider",
    })),
    recentComplaints: (complaintRows.data ?? []).map((row) => ({
      ...mapComplaint(row as ComplaintRow),
      senderLabel: senderMap.get(row.sender_account_id as string) ?? "Sender",
      providerLabel: providerMap.get(row.provider_id as string) ?? "Provider",
    })),
  }
}

export async function listActiveSuppressions(
  admin: SupabaseClient,
  input: { limit?: number } = {},
): Promise<GrowthDeliverySuppressionRecord[]> {
  const { data, error } = await suppressionsTable(admin)
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSuppression(row as SuppressionRow))
}

export async function fetchLeadComplianceDetail(
  admin: SupabaseClient,
  leadId: string,
  input?: { email?: string | null },
): Promise<GrowthLeadComplianceDetail> {
  const emailHash = input?.email ? hashComplianceEmail(input.email) : null

  const [bouncesRes, complaintsRes, timelineRes] = await Promise.all([
    bouncesTable(admin).select("*").eq("lead_id", leadId).order("occurred_at", { ascending: false }).limit(30),
    complaintsTable(admin).select("*").eq("lead_id", leadId).order("occurred_at", { ascending: false }).limit(30),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id, event_type, title, summary, occurred_at")
      .eq("lead_id", leadId)
      .in("event_type", [
        "bounce_detected",
        "hard_bounce_detected",
        "unsubscribe_detected",
        "complaint_detected",
        "suppression_applied",
        "sender_reputation_declined",
        "email_bounced",
        "email_unsubscribed",
        "email_spam_complaint",
      ])
      .order("occurred_at", { ascending: false })
      .limit(30),
  ])

  const suppressionsQuery = suppressionsTable(admin).select("*").eq("active", true).order("created_at", { ascending: false }).limit(30)
  const suppressionsRes = emailHash
    ? await suppressionsQuery.or(`lead_id.eq.${leadId},email_hash.eq.${emailHash}`)
    : await suppressionsQuery.eq("lead_id", leadId)

  const unsubscribesRes = emailHash
    ? await unsubscribesTable(admin).select("*").eq("email_hash", emailHash).order("occurred_at", { ascending: false }).limit(30)
    : { data: [], error: null }

  if (bouncesRes.error) throw new Error(bouncesRes.error.message)
  if (complaintsRes.error) throw new Error(complaintsRes.error.message)
  if (suppressionsRes.error) throw new Error(suppressionsRes.error.message)
  if (unsubscribesRes.error) throw new Error(unsubscribesRes.error.message)
  if (timelineRes.error) throw new Error(timelineRes.error.message)

  return {
    bounces: (bouncesRes.data ?? []).map((row) => mapBounce(row as BounceRow)),
    complaints: (complaintsRes.data ?? []).map((row) => mapComplaint(row as ComplaintRow)),
    unsubscribes: (unsubscribesRes.data ?? []).map((row) => mapUnsubscribe(row as UnsubscribeRow)),
    suppressions: (suppressionsRes.data ?? []).map((row) => mapSuppression(row as SuppressionRow)),
    timeline: (timelineRes.data ?? []).map((row) => ({
      id: row.id as string,
      kind: row.event_type as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      occurredAt: row.occurred_at as string,
    })),
  }
}
