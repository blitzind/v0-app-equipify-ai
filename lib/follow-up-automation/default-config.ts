import type { FollowUpAutomationConfig } from "@/lib/follow-up-automation/types"

/** Conservative defaults — no autonomous sending; categories enabled but safe thresholds. */
export const DEFAULT_FOLLOW_UP_AUTOMATION_CONFIG: FollowUpAutomationConfig = {
  version: 1,
  invoiceFollowUps: {
    enabled: true,
    dueSoonDays: 5,
    finalNoticeDays: 45,
    overdueCadenceDays: 0,
    defaultAssigneeUserId: null,
    draftChannels: ["email"],
    aiDraftsEnabled: true,
  },
  maintenanceReminders: {
    enabled: true,
    dueSoonDays: 14,
    overdueThresholdDays: 0,
    calibrationDueSoonDays: 30,
    warrantyDueSoonDays: 30,
    reminderCadenceDays: 0,
    defaultAssigneeUserId: null,
    draftChannels: ["email"],
    aiDraftsEnabled: true,
  },
  categories: {
    prospects: {
      enabled: true,
      channels: ["email"],
      aiDraftsEnabled: true,
    },
    work_orders: {
      enabled: true,
      channels: ["email"],
      aiDraftsEnabled: true,
    },
    invoices: {
      enabled: true,
      channels: ["email"],
      aiDraftsEnabled: true,
    },
    customers: {
      enabled: true,
      channels: ["email"],
      aiDraftsEnabled: true,
    },
    equipment: {
      enabled: true,
      channels: ["email"],
      aiDraftsEnabled: true,
    },
  },
  thresholds: {
    prospectOverdueFollowupHours: 1,
    prospectProposalNoResponseDays: 7,
    prospectNurtureInactiveDays: 21,
    woSignaturePendingHours: 48,
    woScheduledReminderHoursBefore: 24,
    woCompletedFollowupDays: 3,
    invoiceDueSoonDays: 3,
    customerStaleWoMonths: 6,
    equipmentServiceDueSoonDays: 14,
    equipmentWarrantyExpiringDays: 30,
  },
}
