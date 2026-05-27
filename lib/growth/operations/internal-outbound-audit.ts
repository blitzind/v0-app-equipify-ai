import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthInternalOutboundAuditEvent,
  GrowthInternalOutboundAuditEventType,
} from "@/lib/growth/operations/internal-outbound-ops-types"

export const GROWTH_INTERNAL_OUTBOUND_AUDIT_MIGRATION =
  "20270528120000_growth_engine_internal_outbound_ops.sql" as const

type AuditRow = {
  id: string
  event_type: string
  severity: string
  title: string
  summary: string | null
  created_at: string
}

function auditTable(admin: SupabaseClient) {
  return admin.schema("growth").from("internal_outbound_audit_events")
}

export async function isInternalOutboundAuditSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await auditTable(admin).select("id").limit(1)
  return !error
}

export async function recordInternalOutboundAuditEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthInternalOutboundAuditEventType
    severity?: "low" | "medium" | "high" | "critical"
    title: string
    summary?: string | null
    senderAccountId?: string | null
    senderPoolId?: string | null
    mailboxConnectionId?: string | null
    senderDomainId?: string | null
    deliveryAttemptId?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  if (!(await isInternalOutboundAuditSchemaReady(admin))) return

  const { error } = await auditTable(admin).insert({
    event_type: input.eventType,
    severity: input.severity ?? "medium",
    title: input.title,
    summary: input.summary ?? null,
    sender_account_id: input.senderAccountId ?? null,
    sender_pool_id: input.senderPoolId ?? null,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    sender_domain_id: input.senderDomainId ?? null,
    delivery_attempt_id: input.deliveryAttemptId ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) console.error("[internal-outbound-audit] insert failed:", error.message)
}

export async function listRecentInternalOutboundAuditEvents(
  admin: SupabaseClient,
  limit = 40,
): Promise<GrowthInternalOutboundAuditEvent[]> {
  if (!(await isInternalOutboundAuditSchemaReady(admin))) return []

  const { data, error } = await auditTable(admin)
    .select("id, event_type, severity, title, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as AuditRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type as GrowthInternalOutboundAuditEventType,
    severity: row.severity,
    title: row.title,
    summary: row.summary,
    createdAt: row.created_at,
  }))
}
