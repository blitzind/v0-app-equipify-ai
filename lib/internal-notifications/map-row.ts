import type { InternalEscalationRuleRow, InternalNotificationEventType } from "@/lib/internal-notifications/types"

export function mapEscalationRuleRow(row: Record<string, unknown>): InternalEscalationRuleRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    event_type: row.event_type as InternalNotificationEventType,
    enabled: Boolean(row.enabled),
    channel: (row.channel as string) || "in_app",
    target_roles: (row.target_roles as string[] | null) ?? null,
    target_user_ids: (row.target_user_ids as string[] | null) ?? null,
    threshold_minutes: (row.threshold_minutes as number | null) ?? null,
    warning_minutes: (row.warning_minutes as number | null) ?? null,
    config:
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {},
  }
}
