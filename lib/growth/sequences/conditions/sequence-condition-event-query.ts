import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SequenceConditionEvent } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  maskSequenceConditionEvidenceRef,
  sanitizeSequenceConditionDetail,
  type SequenceConditionMaskedEvidence,
} from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"

export type SequenceConditionAttributionScope = {
  enrollmentId: string
  enrollmentStepId: string
  leadId: string
}

export type SequenceConditionEventQueryResult = {
  found: boolean
  evidence: SequenceConditionMaskedEvidence[]
  attributionScoped: boolean
}

type RawEvidenceRow = {
  id: string
  occurredAt: string | null
  detail: string
}

function buildEvidence(table: string, row: RawEvidenceRow): SequenceConditionMaskedEvidence {
  return {
    ref: maskSequenceConditionEvidenceRef(table, row.id),
    occurredAt: row.occurredAt,
    detail: sanitizeSequenceConditionDetail(row.detail),
  }
}

async function queryAttributedRows(
  admin: SupabaseClient,
  table: string,
  scope: SequenceConditionAttributionScope,
  config: {
    select: string
    enrollmentColumn?: "sequence_enrollment_id" | "enrollment_id"
    stepColumn?: "sequence_enrollment_step_id"
    occurredColumn: string
    detail: (row: Record<string, unknown>) => string
    extraFilter?: (query: ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>) => ReturnType<
      ReturnType<SupabaseClient["schema"]>["from"]
    >
  },
  now: string,
): Promise<SequenceConditionEventQueryResult> {
  let query = admin.schema("growth").from(table).select(config.select).lte(config.occurredColumn, now)

  if (config.enrollmentColumn) {
    query = query.eq(config.enrollmentColumn, scope.enrollmentId)
  }
  if (config.stepColumn) {
    query = query.eq(config.stepColumn, scope.enrollmentStepId)
  }
  if (config.extraFilter) {
    query = config.extraFilter(query)
  }

  const { data, error } = await query.order(config.occurredColumn, { ascending: false }).limit(5)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Record<string, unknown>[]
  const evidence = rows.map((row) =>
    buildEvidence(table, {
      id: String(row.id),
      occurredAt: (row[config.occurredColumn] as string | null) ?? null,
      detail: config.detail(row),
    }),
  )

  return {
    found: evidence.length > 0,
    evidence,
    attributionScoped: Boolean(config.enrollmentColumn || config.stepColumn),
  }
}

const SHARE_PAGE_EVENT_MAP: Partial<Record<SequenceConditionEvent, string[]>> = {
  "share_page.viewed": ["SHARE_PAGE_VIEWED"],
  "share_page.cta_clicked": ["SHARE_PAGE_CTA_CLICKED"],
  "share_page.booking_started": ["SHARE_PAGE_BOOKING_STARTED"],
  "share_page.booking_completed": ["SHARE_PAGE_BOOKING_COMPLETED"],
  "share_page.engaged": [
    "SHARE_PAGE_SCROLL_50",
    "SHARE_PAGE_SCROLL_75",
    "SHARE_PAGE_SCROLL_100",
  ],
}

export async function querySequenceConditionEventEvidence(
  admin: SupabaseClient,
  scope: SequenceConditionAttributionScope,
  event: SequenceConditionEvent,
  now: string,
): Promise<SequenceConditionEventQueryResult> {
  switch (event) {
    case "email.opened":
      return queryAttributedRows(admin, "email_opens", scope, {
        select: "id, opened_at, device_type",
        enrollmentColumn: "sequence_enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "opened_at",
        detail: (row) => `Email open recorded (${String(row.device_type ?? "unknown device")}).`,
      }, now)

    case "email.clicked":
      return queryAttributedRows(admin, "email_clicks", scope, {
        select: "id, clicked_at, destination_url",
        enrollmentColumn: "sequence_enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "clicked_at",
        detail: (row) => `Email click recorded.`,
      }, now)

    case "email.replied": {
      const attributedDelivery = await admin
        .schema("growth")
        .from("delivery_attempts")
        .select("id, sent_at")
        .eq("sequence_enrollment_id", scope.enrollmentId)
        .eq("sequence_enrollment_step_id", scope.enrollmentStepId)
        .eq("lead_id", scope.leadId)
        .lte("sent_at", now)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      let query = admin
        .schema("growth")
        .from("outbound_replies")
        .select("id, received_at, classification")
        .eq("lead_id", scope.leadId)
        .lte("received_at", now)
        .order("received_at", { ascending: false })
        .limit(5)

      if (attributedDelivery.data?.sent_at) {
        query = query.gte("received_at", attributedDelivery.data.sent_at as string)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        buildEvidence("outbound_replies", {
          id: String(row.id),
          occurredAt: (row.received_at as string | null) ?? null,
          detail: `Email reply recorded (${String(row.classification ?? "unclassified")}).`,
        }),
      )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: Boolean(attributedDelivery.data),
      }
    }

    case "email.bounced": {
      const { data, error } = await admin
        .schema("growth")
        .from("message_events")
        .select("id, occurred_at, event_type")
        .eq("lead_id", scope.leadId)
        .eq("event_type", "bounced")
        .lte("occurred_at", now)
        .order("occurred_at", { ascending: false })
        .limit(5)

      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        buildEvidence("message_events", {
          id: String(row.id),
          occurredAt: (row.occurred_at as string | null) ?? null,
          detail: "Email bounce event recorded.",
        }),
      )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: false,
      }
    }

    case "share_page.viewed":
    case "share_page.cta_clicked":
    case "share_page.booking_started":
    case "share_page.booking_completed":
    case "share_page.engaged": {
      const eventTypes = SHARE_PAGE_EVENT_MAP[event] ?? []
      return queryAttributedRows(admin, "share_page_events", scope, {
        select: "id, occurred_at, event_type",
        enrollmentColumn: "enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "occurred_at",
        detail: (row) => `Share page event ${String(row.event_type)} recorded.`,
        extraFilter: (query) => query.in("event_type", eventTypes),
      }, now)
    }

    case "sms.delivered":
      return queryAttributedRows(admin, "sms_delivery_attempts", scope, {
        select: "id, delivered_at, status",
        enrollmentColumn: "sequence_enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "delivered_at",
        detail: (row) => `SMS delivery status ${String(row.status)}.`,
        extraFilter: (query) => query.eq("status", "delivered"),
      }, now)

    case "sms.failed":
      return queryAttributedRows(admin, "sms_delivery_attempts", scope, {
        select: "id, failed_at, status",
        enrollmentColumn: "sequence_enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "failed_at",
        detail: (row) => `SMS delivery status ${String(row.status)}.`,
        extraFilter: (query) => query.in("status", ["failed", "undelivered"]),
      }, now)

    case "sms.replied": {
      const { data: attempts, error: attemptsError } = await admin
        .schema("growth")
        .from("sms_delivery_attempts")
        .select("id, conversation_id, sent_at")
        .eq("sequence_enrollment_id", scope.enrollmentId)
        .eq("sequence_enrollment_step_id", scope.enrollmentStepId)
        .eq("lead_id", scope.leadId)
        .not("conversation_id", "is", null)
        .lte("sent_at", now)
        .order("sent_at", { ascending: false })
        .limit(5)

      if (attemptsError) throw new Error(attemptsError.message)

      const conversationIds = [
        ...new Set(
          ((attempts ?? []) as Array<{ conversation_id: string | null }>)
            .map((row) => row.conversation_id)
            .filter(Boolean),
        ),
      ] as string[]

      if (conversationIds.length === 0) {
        return { found: false, evidence: [], attributionScoped: true }
      }

      const { data, error } = await admin
        .schema("growth")
        .from("sms_messages")
        .select("id, message_timestamp, direction")
        .in("conversation_id", conversationIds)
        .eq("direction", "inbound")
        .lte("message_timestamp", now)
        .order("message_timestamp", { ascending: false })
        .limit(5)

      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        buildEvidence("sms_messages", {
          id: String(row.id),
          occurredAt: (row.message_timestamp as string | null) ?? null,
          detail: "Inbound SMS reply recorded.",
        }),
      )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: true,
      }
    }

    case "voice_drop.delivered":
      return queryChannelEvent(admin, scope, now, ["voice_drop_delivered"], "Voice drop delivered.")

    case "voice_drop.failed": {
      const { data, error } = await admin
        .schema("growth")
        .from("lead_timeline_events")
        .select("id, occurred_at, event_type")
        .eq("lead_id", scope.leadId)
        .eq("event_type", "voice_drop_failed")
        .contains("payload", { sequence_enrollment_id: scope.enrollmentId })
        .lte("occurred_at", now)
        .order("occurred_at", { ascending: false })
        .limit(5)

      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        buildEvidence("lead_timeline_events", {
          id: String(row.id),
          occurredAt: (row.occurred_at as string | null) ?? null,
          detail: "Voice drop failed.",
        }),
      )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: true,
      }
    }

    case "call_task.completed":
      return queryAttributedRows(admin, "cadence_tasks", scope, {
        select: "id, completed_at, status, outcome",
        enrollmentColumn: "sequence_enrollment_id",
        stepColumn: "sequence_enrollment_step_id",
        occurredColumn: "completed_at",
        detail: (row) => `Cadence task ${String(row.status)} (${String(row.outcome ?? "no outcome")}).`,
        extraFilter: (query) => query.eq("status", "completed"),
      }, now)

    case "media.viewed":
      return queryLeadScopedMediaAssetEvents(admin, scope, now, ["video_viewed"], "Media view recorded.")

    case "media.play_started":
      return queryLeadScopedMediaAssetEvents(admin, scope, now, ["video_play_started"], "Media play started.")

    case "media.completed":
      return queryLeadScopedMediaAssetEvents(admin, scope, now, ["video_completed"], "Media playback completed.")

    case "media.cta_clicked":
      return queryLeadScopedMediaAssetEvents(admin, scope, now, ["video_cta_clicked"], "Media CTA clicked.")

    case "booking_handoff.ready": {
      const { data, error } = await admin
        .schema("growth")
        .from("signals")
        .select("id, occurred_at, signal_type, metadata")
        .eq("provider_key", "media_booking_handoff")
        .contains("metadata", { lead_id: scope.leadId, booking_handoff_ready: true })
        .lte("occurred_at", now)
        .order("occurred_at", { ascending: false })
        .limit(5)

      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        buildEvidence("signals", {
          id: String(row.id),
          occurredAt: (row.occurred_at as string | null) ?? null,
          detail: "Booking handoff readiness recorded.",
        }),
      )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: false,
      }
    }

    case "high_intent.detected": {
      const { data, error } = await admin
        .schema("growth")
        .from("signals")
        .select("id, occurred_at, signal_type, signal_score, metadata")
        .in("signal_type", [
          "share_page_viewed",
          "share_page_engaged",
          "share_page_cta_clicked",
          "share_page_booking_started",
          "share_page_booking_completed",
        ])
        .lte("occurred_at", now)
        .order("occurred_at", { ascending: false })
        .limit(20)

      if (error) throw new Error(error.message)

      const evidence = ((data ?? []) as Array<Record<string, unknown>>)
        .filter((row) => {
          const metadata = row.metadata
          if (!metadata || typeof metadata !== "object") return false
          return String((metadata as Record<string, unknown>).lead_id ?? "") === scope.leadId
        })
        .slice(0, 5)
        .map((row) =>
          buildEvidence("signals", {
            id: String(row.id),
            occurredAt: (row.occurred_at as string | null) ?? null,
            detail: `High-intent signal ${String(row.signal_type)} recorded.`,
          }),
        )

      return {
        found: evidence.length > 0,
        evidence,
        attributionScoped: false,
      }
    }

    default:
      return { found: false, evidence: [], attributionScoped: false }
  }
}

async function queryLeadScopedMediaAssetEvents(
  admin: SupabaseClient,
  scope: SequenceConditionAttributionScope,
  now: string,
  eventTypes: string[],
  detail: string,
): Promise<SequenceConditionEventQueryResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("media_asset_events")
    .select("id, event_timestamp, event_type, session_id, progress_seconds, progress_percent, cta_key")
    .eq("lead_id", scope.leadId)
    .in("event_type", eventTypes)
    .lte("event_timestamp", now)
    .order("event_timestamp", { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)

  const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    buildEvidence("media_asset_events", {
      id: String(row.id),
      occurredAt: (row.event_timestamp as string | null) ?? null,
      detail,
    }),
  )

  return {
    found: evidence.length > 0,
    evidence,
    attributionScoped: false,
  }
}

async function queryChannelEvent(
  admin: SupabaseClient,
  scope: SequenceConditionAttributionScope,
  now: string,
  eventKinds: string[],
  detail: string,
): Promise<SequenceConditionEventQueryResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_channel_events")
    .select("id, occurred_at, event_kind")
    .eq("enrollment_id", scope.enrollmentId)
    .eq("enrollment_step_id", scope.enrollmentStepId)
    .eq("lead_id", scope.leadId)
    .in("event_kind", eventKinds)
    .lte("occurred_at", now)
    .order("occurred_at", { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)

  const evidence = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    buildEvidence("sequence_enrollment_channel_events", {
      id: String(row.id),
      occurredAt: (row.occurred_at as string | null) ?? null,
      detail,
    }),
  )

  return {
    found: evidence.length > 0,
    evidence,
    attributionScoped: true,
  }
}

export async function queryLeadFieldEvidence(
  admin: SupabaseClient,
  leadId: string,
): Promise<{
  status: string | null
  engagementTier: string | null
  nextBestAction: string | null
  engagementScore: number | null
  engagementScoreTier: string | null
}> {
  const [{ data: lead, error: leadError }, { data: score, error: scoreError }] = await Promise.all([
    admin
      .schema("growth")
      .from("leads")
      .select("id, status, engagement_tier, next_best_action")
      .eq("id", leadId)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("engagement_scores")
      .select("lead_id, score, tier")
      .eq("lead_id", leadId)
      .maybeSingle(),
  ])

  if (leadError) throw new Error(leadError.message)
  if (scoreError) throw new Error(scoreError.message)

  return {
    status: (lead?.status as string | null) ?? null,
    engagementTier: (lead?.engagement_tier as string | null) ?? null,
    nextBestAction: (lead?.next_best_action as string | null) ?? null,
    engagementScore: score?.score != null ? Number(score.score) : null,
    engagementScoreTier: (score?.tier as string | null) ?? null,
  }
}
