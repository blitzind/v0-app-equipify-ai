import { DEFAULT_FOLLOW_UP_AUTOMATION_CONFIG } from "@/lib/follow-up-automation/default-config"
import {
  followUpAutomationConfigSchema,
  type FollowUpAutomationConfig,
} from "@/lib/follow-up-automation/types"

export function mergeFollowUpAutomationConfig(stored: unknown): FollowUpAutomationConfig {
  const d = DEFAULT_FOLLOW_UP_AUTOMATION_CONFIG
  if (!stored || typeof stored !== "object") {
    return followUpAutomationConfigSchema.parse(d)
  }
  const s = stored as Partial<FollowUpAutomationConfig>
  const merged: FollowUpAutomationConfig = {
    ...d,
    ...s,
    version: 1,
    categories: {
      prospects: { ...d.categories.prospects, ...(s.categories?.prospects ?? {}) },
      work_orders: { ...d.categories.work_orders, ...(s.categories?.work_orders ?? {}) },
      invoices: { ...d.categories.invoices, ...(s.categories?.invoices ?? {}) },
      customers: { ...d.categories.customers, ...(s.categories?.customers ?? {}) },
      equipment: { ...d.categories.equipment, ...(s.categories?.equipment ?? {}) },
    },
    thresholds: { ...d.thresholds, ...(s.thresholds ?? {}) },
    maintenanceReminders: {
      ...d.maintenanceReminders,
      ...(s.maintenanceReminders ?? {}),
    },
    invoiceFollowUps: {
      ...d.invoiceFollowUps,
      ...(s.invoiceFollowUps ?? {}),
    },
  }
  const parsed = followUpAutomationConfigSchema.safeParse(merged)
  return parsed.success ? parsed.data : followUpAutomationConfigSchema.parse(d)
}
