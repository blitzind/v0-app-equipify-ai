import { z } from "zod"

export const FOLLOW_UP_RULE_KEYS = [
  "prospect_followup_overdue",
  "prospect_proposal_no_response",
  "prospect_nurture_inactive",
  "wo_signature_pending",
  "wo_scheduled_reminder",
  "wo_completed_followup",
  "invoice_overdue",
  "invoice_due_soon",
  "customer_stale_no_completed_wo",
  "equipment_service_due_soon",
  "equipment_warranty_expiring_soon",
] as const

export type FollowUpRuleKey = (typeof FOLLOW_UP_RULE_KEYS)[number]

export const FOLLOW_UP_ENTITY_TYPES = ["prospect", "work_order", "invoice", "customer", "equipment"] as const
export type FollowUpEntityType = (typeof FOLLOW_UP_ENTITY_TYPES)[number]

export const followUpAutomationConfigSchema = z.object({
  version: z.literal(1),
  categories: z.object({
    prospects: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["email", "sms"])),
      aiDraftsEnabled: z.boolean(),
    }),
    work_orders: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["email", "sms"])),
      aiDraftsEnabled: z.boolean(),
    }),
    invoices: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["email", "sms"])),
      aiDraftsEnabled: z.boolean(),
    }),
    customers: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["email", "sms"])),
      aiDraftsEnabled: z.boolean(),
    }),
    equipment: z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["email", "sms"])),
      aiDraftsEnabled: z.boolean(),
    }),
  }),
  thresholds: z.object({
    prospectOverdueFollowupHours: z.number().min(1).max(720),
    prospectProposalNoResponseDays: z.number().min(1).max(120),
    prospectNurtureInactiveDays: z.number().min(1).max(365),
    woSignaturePendingHours: z.number().min(1).max(720),
    woScheduledReminderHoursBefore: z.number().min(1).max(168),
    woCompletedFollowupDays: z.number().min(1).max(365),
    invoiceDueSoonDays: z.number().min(1).max(90),
    customerStaleWoMonths: z.number().min(1).max(60),
    equipmentServiceDueSoonDays: z.number().min(1).max(365),
    equipmentWarrantyExpiringDays: z.number().min(1).max(365),
  }),
})

export type FollowUpAutomationConfig = z.infer<typeof followUpAutomationConfigSchema>

export type FollowUpTaskRow = {
  id: string
  organization_id: string
  entity_type: FollowUpEntityType
  entity_id: string
  rule_key: string
  status: "pending" | "approved" | "sent" | "dismissed" | "failed"
  priority: "low" | "normal" | "high"
  assigned_to_user_id: string | null
  dedupe_key: string
  generated_at: string
  scheduled_for: string | null
  completed_at: string | null
  dismissed_at: string | null
  draft_payload: Record<string, unknown>
  communication_event_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
