import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordDeliveryTimelineEvent } from "@/lib/growth/deliverability/delivery-event-timeline"
import type { GrowthDeliveryTimelineEventType } from "@/lib/growth/deliverability/deliverability-intelligence-types"
import type {
  GrowthDeliverabilityGovernanceEvent,
  GrowthDeliverabilityGovernanceEventType,
} from "@/lib/growth/deliverability/reputation-protection-types"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import type { GrowthInternalOutboundAuditEventType } from "@/lib/growth/operations/internal-outbound-ops-types"

function governanceTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_governance_events")
}

function timelineTypeForGovernance(
  eventType: GrowthDeliverabilityGovernanceEventType,
): GrowthDeliveryTimelineEventType {
  if (
    eventType === "mailbox_paused" ||
    eventType === "bounce_threshold_triggered" ||
    eventType === "complaint_threshold_triggered"
  ) {
    return "sender_paused"
  }
  if (eventType === "send_throttle_applied") return "throttled"
  return "protection_applied"
}

function auditTypeForGovernance(
  eventType: GrowthDeliverabilityGovernanceEventType,
): GrowthInternalOutboundAuditEventType {
  if (eventType === "send_throttle_applied") return "pre_send_blocked"
  if (eventType === "deliverability_risk_detected") return "domain_risk_alert"
  return "sender_operational_pause"
}

export async function appendDeliverabilityGovernanceEvent(
  admin: SupabaseClient,
  input: {
    event_type: GrowthDeliverabilityGovernanceEventType
    sender_account_id?: string | null
    mailbox_connection_id?: string | null
    title: string
    summary: string
    severity?: "low" | "medium" | "high" | "critical"
    reversible?: boolean
    operator_override?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<GrowthDeliverabilityGovernanceEvent | null> {
  const { data, error } = await governanceTable(admin)
    .insert({
      event_type: input.event_type,
      sender_account_id: input.sender_account_id ?? null,
      mailbox_connection_id: input.mailbox_connection_id ?? null,
      title: input.title,
      summary: input.summary,
      severity: input.severity ?? "medium",
      reversible: input.reversible ?? true,
      operator_override: input.operator_override ?? false,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  const event: GrowthDeliverabilityGovernanceEvent = {
    id: String(row.id),
    event_type: String(row.event_type) as GrowthDeliverabilityGovernanceEventType,
    sender_account_id: row.sender_account_id ? String(row.sender_account_id) : null,
    mailbox_connection_id: row.mailbox_connection_id ? String(row.mailbox_connection_id) : null,
    title: String(row.title),
    summary: String(row.summary),
    severity: String(row.severity) as GrowthDeliverabilityGovernanceEvent["severity"],
    reversible: Boolean(row.reversible),
    operator_override: Boolean(row.operator_override),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  }

  await recordDeliveryTimelineEvent(admin, {
    normalizedType: timelineTypeForGovernance(event.event_type),
    severity: event.severity,
    title: event.title,
    summary: event.summary,
    senderAccountId: event.sender_account_id,
    mailboxConnectionId: event.mailbox_connection_id,
    dedupeKey: `governance:${event.event_type}:${event.sender_account_id ?? "platform"}:${event.created_at.slice(0, 16)}`,
    occurredAt: event.created_at,
    metadata: { governance_event_type: event.event_type, ...event.metadata },
  }).catch(() => undefined)

  await recordInternalOutboundAuditEvent(admin, {
    eventType: auditTypeForGovernance(event.event_type),
    severity: event.severity,
    title: event.title,
    summary: event.summary,
    senderAccountId: event.sender_account_id,
    mailboxConnectionId: event.mailbox_connection_id,
    metadata: { governance_event_type: event.event_type, ...event.metadata },
  }).catch(() => undefined)

  return event
}

export async function listDeliverabilityGovernanceEvents(
  admin: SupabaseClient,
  limit = 30,
): Promise<GrowthDeliverabilityGovernanceEvent[]> {
  const { data, error } = await governanceTable(admin)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  return data.map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      event_type: String(record.event_type) as GrowthDeliverabilityGovernanceEventType,
      sender_account_id: record.sender_account_id ? String(record.sender_account_id) : null,
      mailbox_connection_id: record.mailbox_connection_id ? String(record.mailbox_connection_id) : null,
      title: String(record.title),
      summary: String(record.summary),
      severity: String(record.severity) as GrowthDeliverabilityGovernanceEvent["severity"],
      reversible: Boolean(record.reversible),
      operator_override: Boolean(record.operator_override),
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      created_at: String(record.created_at),
    }
  })
}
