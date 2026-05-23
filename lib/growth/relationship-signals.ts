import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { daysSince } from "@/lib/growth/engagement-decay"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import type { GrowthLeadRelationshipInput, GrowthRelationshipSignal } from "@/lib/growth/relationship-types"
import { MEANINGFUL_TOUCH_KINDS } from "@/lib/growth/relationship-meaningful-touch"
import type { GrowthLead } from "@/lib/growth/types"

const LOOKBACK_DAYS = 180
const FAILED_ATTEMPT_WINDOW_DAYS = 14
const FAILED_ATTEMPT_THRESHOLD = 3
const MULTIPLE_TOUCHPOINT_WINDOW_DAYS = 30
const MULTIPLE_TOUCHPOINT_MIN_KINDS = 3

export async function fetchGrowthLeadRelationshipInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadRelationshipInput> {
  const now = new Date()
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const signals: GrowthRelationshipSignal[] = []

  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail)

  const { data: messageEvents, error: messageError } = await admin
    .schema("growth")
    .from("message_events")
    .select("event_type, occurred_at")
    .eq("lead_id", lead.id)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })

  if (messageError) throw new Error(messageError.message)

  for (const row of messageEvents ?? []) {
    const occurredAt = row.occurred_at as string
    switch (row.event_type) {
      case "bounced":
        signals.push({ kind: "bounce", occurredAt, label: "Email bounced" })
        break
      case "unsubscribed":
        signals.push({ kind: "unsubscribe", occurredAt, label: "Unsubscribed" })
        break
      default:
        break
    }
  }

  if (
    emailSummary.latestReplyClassification === "interested" &&
    emailSummary.lastReplyAt
  ) {
    signals.push({
      kind: "positive_reply",
      occurredAt: emailSummary.lastReplyAt,
      label: "Positive email reply",
    })
  }
  if (emailSummary.latestReplyClassification === "not_interested" && emailSummary.lastReplyAt) {
    signals.push({
      kind: "not_interested",
      occurredAt: emailSummary.lastReplyAt,
      label: "Not interested reply",
    })
  }
  if (emailSummary.isSuppressed) {
    signals.push({
      kind: "suppression",
      occurredAt: emailSummary.lastReplyAt ?? emailSummary.lastSentAt ?? lead.updatedAt,
      label: "Email suppressed",
    })
  }

  const { data: timelineRows, error: timelineError } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("event_type, title, occurred_at")
    .eq("lead_id", lead.id)
    .gte("occurred_at", since)
    .in("event_type", [
      "manual_touch",
      "follow_up_completed",
      "interested",
      "call_started",
      "decision_maker_confirmed",
      "notes_updated",
    ])
    .order("occurred_at", { ascending: false })

  if (timelineError) throw new Error(timelineError.message)

  for (const row of timelineRows ?? []) {
    const occurredAt = row.occurred_at as string
    switch (row.event_type) {
      case "manual_touch":
        signals.push({ kind: "manual_touch", occurredAt, label: "Manual touch" })
        break
      case "follow_up_completed":
        signals.push({ kind: "follow_up_completed", occurredAt, label: "Follow-up completed" })
        break
      case "interested":
      case "call_started":
        signals.push({ kind: "connected_call", occurredAt, label: row.title ?? "Call connected" })
        break
      case "decision_maker_confirmed":
        signals.push({ kind: "decision_maker_confirmed", occurredAt, label: "Decision maker confirmed" })
        break
      case "notes_updated":
        signals.push({ kind: "human_note_activity", occurredAt, label: "Human note activity" })
        break
      default:
        break
    }
  }

  if (lead.lastHumanTouchAt && !signals.some((s) => s.kind === "manual_touch")) {
    signals.push({
      kind: "manual_touch",
      occurredAt: lead.lastHumanTouchAt,
      label: "Human touch",
    })
  }

  if (lead.callDisposition === "interested" && lead.lastCallAt) {
    signals.push({
      kind: "connected_call",
      occurredAt: lead.lastCallAt,
      label: "Interested call",
    })
  }

  if (
    (lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable") &&
    !signals.some((s) => s.kind === "decision_maker_confirmed")
  ) {
    signals.push({
      kind: "decision_maker_confirmed",
      occurredAt: lead.updatedAt,
      label: "Decision maker confirmed",
    })
  }

  const hasDmEngagement =
    (lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable") &&
    signals.some((s) => s.kind === "connected_call" || s.kind === "positive_reply")
  if (hasDmEngagement) {
    const latest = signals
      .filter((s) => s.kind === "connected_call" || s.kind === "positive_reply")
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
    if (latest) {
      signals.push({
        kind: "decision_maker_engagement",
        occurredAt: latest.occurredAt,
        label: "Decision maker engagement",
      })
    }
  }

  const sinceFailed = new Date(now.getTime() - FAILED_ATTEMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: callEvents, error: callError } = await admin
    .schema("growth")
    .from("lead_call_events")
    .select("disposition, created_at")
    .eq("lead_id", lead.id)
    .gte("created_at", sinceFailed)
    .order("created_at", { ascending: false })

  if (callError) throw new Error(callError.message)

  const failedDispositions = new Set(["no_answer", "left_voicemail", "call_attempted"])
  const failedCount = (callEvents ?? []).filter((row) =>
    failedDispositions.has(row.disposition as string),
  ).length
  if (failedCount >= FAILED_ATTEMPT_THRESHOLD) {
    const latestFailed = (callEvents ?? []).find((row) =>
      failedDispositions.has(row.disposition as string),
    )
    signals.push({
      kind: "multiple_failed_attempts",
      occurredAt: (latestFailed?.created_at as string) ?? now.toISOString(),
      label: `${failedCount} failed call attempts (${FAILED_ATTEMPT_WINDOW_DAYS}d)`,
    })
  }

  const touchpointKinds = new Set(
    signals
      .filter((s) => MEANINGFUL_TOUCH_KINDS.has(s.kind) && s.kind !== "multiple_touchpoints")
      .filter((s) => daysSince(s.occurredAt, now) <= MULTIPLE_TOUCHPOINT_WINDOW_DAYS)
      .map((s) => s.kind),
  )
  if (touchpointKinds.size >= MULTIPLE_TOUCHPOINT_MIN_KINDS) {
    const latest = signals
      .filter((s) => MEANINGFUL_TOUCH_KINDS.has(s.kind))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
    if (latest) {
      signals.push({
        kind: "multiple_touchpoints",
        occurredAt: latest.occurredAt,
        label: `${touchpointKinds.size} meaningful touch types (${MULTIPLE_TOUCHPOINT_WINDOW_DAYS}d)`,
      })
    }
  }

  return {
    status: lead.status,
    fit: lead.score,
    signals,
    isSuppressed: emailSummary.isSuppressed,
    previousScore: lead.relationshipStrengthScore,
    previousTier: lead.relationshipStrengthTier,
    previousTrend: lead.relationshipTrend,
    engagementTier: lead.engagementTier,
  }
}

export function countNewRelationshipRecoveryTouches(
  signals: GrowthRelationshipSignal[],
  previousLastMeaningfulTouchAt: string | null,
): number {
  if (!previousLastMeaningfulTouchAt) return 0
  const since = Date.parse(previousLastMeaningfulTouchAt)
  const recoveryKinds = new Set(["manual_touch", "connected_call", "positive_reply", "follow_up_completed", "decision_maker_engagement"])
  return signals.filter(
    (signal) =>
      recoveryKinds.has(signal.kind) &&
      Date.parse(signal.occurredAt) > since,
  ).length
}
