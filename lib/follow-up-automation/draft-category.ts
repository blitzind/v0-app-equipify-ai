import type { FollowUpAutomationConfig } from "@/lib/follow-up-automation/types"
import { isInvoiceFollowUpRuleKey } from "@/lib/follow-up-automation/invoice-rules"
import { isMaintenanceReminderRuleKey } from "@/lib/follow-up-automation/maintenance-rules"

export type DraftCategorySettings = {
  aiDraftsEnabled: boolean
  channels: ("email" | "sms")[]
}

/**
 * Resolves which automation toggles apply when generating follow-up drafts.
 * Maintenance reminder tasks use {@link FollowUpAutomationConfig.maintenanceReminders}, not entity categories.
 */
export function resolveDraftCategorySettings(
  cfg: FollowUpAutomationConfig,
  args: { entityType: string; ruleKey: string },
): DraftCategorySettings | null {
  if (args.entityType === "maintenance_plan" || isMaintenanceReminderRuleKey(args.ruleKey)) {
    const mr = cfg.maintenanceReminders
    return {
      aiDraftsEnabled: mr.aiDraftsEnabled,
      channels: mr.draftChannels,
    }
  }
  if (args.entityType === "invoice" && cfg.invoiceFollowUps.enabled && isInvoiceFollowUpRuleKey(args.ruleKey)) {
    const inv = cfg.invoiceFollowUps
    return {
      aiDraftsEnabled: inv.aiDraftsEnabled,
      channels: inv.draftChannels,
    }
  }
  switch (args.entityType) {
    case "prospect":
      return cfg.categories.prospects
    case "work_order":
      return cfg.categories.work_orders
    case "invoice":
      return cfg.categories.invoices
    case "customer":
      return cfg.categories.customers
    case "equipment":
      return cfg.categories.equipment
    case "quote":
      return cfg.categories.invoices
    default:
      return null
  }
}
