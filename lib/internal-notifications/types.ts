import type { SupabaseClient } from "@supabase/supabase-js"

export const INTERNAL_NOTIFICATION_EVENT_TYPES = [
  "service_request_new",
  "service_request_sla_at_risk",
  "service_request_sla_overdue",
  "work_order_overdue",
  "work_order_unassigned",
  "maintenance_due_soon",
  "maintenance_overdue",
  "quote_approved",
  "quote_declined",
  "invoice_overdue",
  "repeat_failure_risk",
  "warranty_expiring_soon",
] as const

export type InternalNotificationEventType = (typeof INTERNAL_NOTIFICATION_EVENT_TYPES)[number]

export type InternalEscalationRuleRow = {
  id: string
  organization_id: string
  name: string
  event_type: InternalNotificationEventType
  enabled: boolean
  channel: string
  target_roles: string[] | null
  target_user_ids: string[] | null
  threshold_minutes: number | null
  warning_minutes: number | null
  config: Record<string, unknown>
}

export type InternalNotificationCandidate = {
  dedupeKey: string
  eventType: InternalNotificationEventType
  ruleId: string
  title: string
  body: string
  severity: "info" | "warning" | "critical"
  href?: string | null
  entityType: "work_order" | "service_request" | "equipment" | "quote" | "invoice" | null
  entityId: string | null
  customerId: string | null
  equipmentId: string | null
  workOrderId: string | null
}

export type EvaluateInternalRulesContext = {
  supabase: SupabaseClient
  organizationId: string
  rules: InternalEscalationRuleRow[]
  now: Date
  /** When false, invoice_overdue rules return no candidates (no DB read for invoices). */
  allowFinancialQueries: boolean
}
