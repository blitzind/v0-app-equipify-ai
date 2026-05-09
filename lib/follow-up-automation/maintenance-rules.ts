/** Rule keys owned by Phase 24 maintenance reminder automation (draft + queue semantics). */
export const MAINTENANCE_REMINDER_RULE_KEYS = [
  "maintenance_plan_due_soon",
  "maintenance_plan_overdue",
  "equipment_service_due_soon",
  "equipment_service_overdue",
  "equipment_calibration_due_soon",
  "equipment_warranty_expiring_soon",
] as const

export type MaintenanceReminderRuleKey = (typeof MAINTENANCE_REMINDER_RULE_KEYS)[number]

const KEY_SET = new Set<string>(MAINTENANCE_REMINDER_RULE_KEYS)

export function isMaintenanceReminderRuleKey(ruleKey: string): boolean {
  return KEY_SET.has(ruleKey)
}
