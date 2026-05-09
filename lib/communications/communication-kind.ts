/**
 * Phase 28 — unified communication categories for the Communications Center.
 * Derived from `event_type` + `metadata` without schema migrations.
 */

import type { CommunicationEventRow } from "@/lib/notifications/types"

function isDraftLike(r: CommunicationEventRow): boolean {
  if (r.event_type.includes("draft")) return true
  const md = r.metadata as Record<string, unknown> | null
  return Boolean(md && md.is_draft === true)
}

function isAiLike(r: CommunicationEventRow): boolean {
  if (r.event_type.startsWith("prospect_ai_") || r.event_type.startsWith("ai_")) return true
  const md = r.metadata as Record<string, unknown> | null
  return Boolean(md && md.ai_generated === true)
}

export type CommunicationCenterKind =
  | "follow_up"
  | "invoice_reminder"
  | "maintenance_reminder"
  | "appointment_reminder"
  | "service_update"
  | "quote_follow_up"
  | "internal_note"
  | "ai_draft"
  | "missed_call_follow_up"
  | "general"

export const COMMUNICATION_CENTER_KINDS: CommunicationCenterKind[] = [
  "follow_up",
  "invoice_reminder",
  "maintenance_reminder",
  "appointment_reminder",
  "service_update",
  "quote_follow_up",
  "internal_note",
  "ai_draft",
  "missed_call_follow_up",
  "general",
]

export const COMMUNICATION_KIND_LABEL: Record<CommunicationCenterKind, string> = {
  follow_up: "Follow-up",
  invoice_reminder: "Invoice reminder",
  maintenance_reminder: "Maintenance reminder",
  appointment_reminder: "Appointment reminder",
  service_update: "Service update",
  quote_follow_up: "Quote follow-up",
  internal_note: "Internal note",
  ai_draft: "AI draft",
  missed_call_follow_up: "Missed call follow-up",
  general: "Communication",
}

function metaStr(r: CommunicationEventRow, key: string): string | null {
  const md = r.metadata as Record<string, unknown> | null
  if (!md || typeof md !== "object") return null
  const v = md[key]
  return typeof v === "string" ? v : null
}

/**
 * Optional override writers may set: metadata.communication_kind = Phase 28 id.
 */
export function deriveCommunicationCenterKind(r: CommunicationEventRow): CommunicationCenterKind {
  const override = metaStr(r, "communication_kind")
  if (
    override &&
    (COMMUNICATION_CENTER_KINDS as string[]).includes(override)
  ) {
    return override as CommunicationCenterKind
  }

  const ruleKey = (metaStr(r, "rule_key") ?? "").toLowerCase()

  if (ruleKey.includes("missed_call") || r.event_type.includes("missed_call")) {
    return "missed_call_follow_up"
  }

  if (
    r.event_type === "invoice_reminder" ||
    r.event_type === "invoice_overdue_notice" ||
    r.event_type === "invoice_email"
  ) {
    return "invoice_reminder"
  }

  if (r.event_type === "maintenance_reminder") return "maintenance_reminder"
  if (r.event_type === "quote_follow_up" || r.event_type === "quote_email") return "quote_follow_up"

  if (
    r.event_type === "appointment_confirmation" ||
    r.event_type === "scheduling_event" ||
    r.event_type === "work_order_reminder"
  ) {
    return "appointment_reminder"
  }

  if (r.event_type === "internal_notice") return "internal_note"

  if (
    r.event_type.startsWith("prospect_ai") ||
    r.event_type === "ai_followup_email_draft" ||
    r.event_type === "prospect_ai_draft_generated" ||
    (isDraftLike(r) && isAiLike(r))
  ) {
    return "ai_draft"
  }

  if (
    r.event_type === "prospect_follow_up" ||
    ruleKey.includes("follow_up") ||
    r.related_entity_type === "prospect"
  ) {
    return "follow_up"
  }

  if (
    r.event_type === "work_order_summary_email" ||
    r.event_type === "certificate_released" ||
    r.event_type === "certificate_uploaded" ||
    r.event_type === "customer_inbound"
  ) {
    return "service_update"
  }

  if (r.event_type === "email_outbound" || r.event_type === "sms_outbound") {
    return "general"
  }

  return "general"
}
