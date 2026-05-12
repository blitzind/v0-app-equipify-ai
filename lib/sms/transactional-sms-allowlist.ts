import type { WorkspaceAlertType } from "@/lib/notifications/workspace-alert-registry"

/** Transactional SMS send allowlist (phase 1). UI may still hide SMS for other rows. */
export const TRANSACTIONAL_SMS_ALERT_TYPES = ["work_order_completed", "schedule_changes"] as const satisfies readonly WorkspaceAlertType[]

export function isTransactionalSmsAlertType(t: WorkspaceAlertType): boolean {
  return (TRANSACTIONAL_SMS_ALERT_TYPES as readonly string[]).includes(t)
}
