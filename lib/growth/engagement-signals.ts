import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import type { GrowthEngagementSignal, GrowthLeadEngagementInput } from "@/lib/growth/engagement-types"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import type { GrowthLead } from "@/lib/growth/types"

export async function fetchGrowthLeadEngagementInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadEngagementInput> {
  const now = new Date()
  const since90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const signals: GrowthEngagementSignal[] = []

  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail)

  const { data: messageEvents, error: messageError } = await admin
    .schema("growth")
    .from("message_events")
    .select("event_type, occurred_at")
    .eq("lead_id", lead.id)
    .gte("occurred_at", since90d)
    .order("occurred_at", { ascending: false })

  if (messageError) throw new Error(messageError.message)

  for (const row of messageEvents ?? []) {
    const occurredAt = row.occurred_at as string
    switch (row.event_type) {
      case "opened":
        signals.push({ kind: "email_open", occurredAt, label: "Email opened" })
        break
      case "clicked":
        signals.push({ kind: "email_click", occurredAt, label: "Email clicked" })
        break
      case "replied":
        signals.push({ kind: "email_reply", occurredAt, label: "Email reply" })
        break
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
    .gte("occurred_at", since90d)
    .in("event_type", [
      "manual_touch",
      "follow_up_completed",
      "interested",
      "call_started",
      "decision_maker_confirmed",
      "research_completed",
      "share_page_viewed",
      "share_page_engaged",
      "share_page_cta_clicked",
      "share_page_booking_started",
      "share_page_booking_completed",
      "share_page_resource_opened",
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
        signals.push({ kind: "call_connected", occurredAt, label: row.title ?? "Call connected" })
        break
      case "decision_maker_confirmed":
        signals.push({ kind: "decision_maker_confirmed", occurredAt, label: "Decision maker confirmed" })
        break
      case "research_completed":
        signals.push({ kind: "research_completed", occurredAt, label: "Research completed" })
        break
      case "share_page_viewed":
        signals.push({ kind: "share_page_view", occurredAt, label: row.title ?? "Share page viewed" })
        break
      case "share_page_engaged":
        signals.push({ kind: "share_page_engaged", occurredAt, label: row.title ?? "Share page engaged" })
        break
      case "share_page_cta_clicked":
        signals.push({ kind: "share_page_cta_click", occurredAt, label: row.title ?? "Share page CTA clicked" })
        break
      case "share_page_booking_completed":
        signals.push({
          kind: "share_page_booking_completed",
          occurredAt,
          label: row.title ?? "Share page booking completed",
        })
        break
      default:
        break
    }
  }

  if (
    lead.lastResearchedAt &&
    hasUsableResearch(lead.lastResearchedAt, lead.latestResearchRunId) &&
    !signals.some((s) => s.kind === "research_completed")
  ) {
    signals.push({
      kind: "research_completed",
      occurredAt: lead.lastResearchedAt,
      label: "Research completed",
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

  if (lead.lastHumanTouchAt && !signals.some((s) => s.kind === "manual_touch")) {
    signals.push({
      kind: "manual_touch",
      occurredAt: lead.lastHumanTouchAt,
      label: "Human touch",
    })
  }

  if (lead.callDisposition === "interested" && lead.lastCallAt) {
    signals.push({
      kind: "call_connected",
      occurredAt: lead.lastCallAt,
      label: "Interested call",
    })
  }

  return {
    status: lead.status,
    signals,
    isSuppressed: emailSummary.isSuppressed,
    dormancyExemptUntil: lead.engagementDormancyExemptUntil,
  }
}
