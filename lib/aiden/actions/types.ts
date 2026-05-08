import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgPermissions } from "@/lib/permissions/model"

export type AidenActionType =
  | "create_work_order"
  | "create_customer"
  | "create_equipment"
  | "create_maintenance_plan"
  | "create_invoice"
  | "create_quote"
  | "schedule_work_order"
  | "assign_technician"

export const AidenProposedActionSchema = z.object({
  type: z.enum([
    "create_work_order",
    "create_customer",
    "create_equipment",
    "create_maintenance_plan",
    "create_invoice",
    "create_quote",
    "schedule_work_order",
    "assign_technician",
  ]),
  status: z.enum(["draft", "awaiting_confirmation", "executing", "completed", "failed"]).default("awaiting_confirmation"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1000),
  previewData: z.record(z.unknown()).default({}),
  confirmationRequired: z.literal(true).default(true),
})

export type AidenProposedAction = z.infer<typeof AidenProposedActionSchema>

export type AidenActionExecutionResult = {
  id: string
  label: string
  href?: string
  message: string
}

export type AidenActionExecutorContext = {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
}

export type AidenActionDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  type: AidenActionType
  label: string
  description: string
  schema: TSchema
  execute: (
    ctx: AidenActionExecutorContext,
    payload: z.infer<TSchema>,
  ) => Promise<AidenActionExecutionResult>
}
