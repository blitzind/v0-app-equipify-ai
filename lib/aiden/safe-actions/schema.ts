import { z } from "zod"

export const SAFE_ACTION_TYPES = [
  "create_follow_up_task",
  "create_internal_note",
  "create_reminder",
  "create_communication_draft",
] as const

export type SafeActionType = (typeof SAFE_ACTION_TYPES)[number]

const sharedPrepareFields = z.object({
  title: z.string().min(1).max(240),
  explanation: z.string().min(1).max(8000),
  risk_level: z.enum(["low", "medium", "high"]),
  confirmation_required: z.literal(true),
})

const followUpPayload = z.object({
  work_order_id: z.string().uuid(),
  task_title: z.string().min(1).max(500),
  task_description: z.string().max(4000).optional(),
})

const internalNotePayload = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("work_order"),
    work_order_id: z.string().uuid(),
    body: z.string().min(1).max(8000),
  }),
  z.object({
    target: z.literal("customer"),
    customer_id: z.string().uuid(),
    body: z.string().min(1).max(8000),
  }),
])

const reminderPayload = z
  .object({
    remind_at: z.string(),
    detail: z.string().max(4000).optional(),
    related_entity_type: z.enum(["work_order", "customer", "none"]).optional(),
    related_entity_id: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    const t = val.related_entity_type ?? "none"
    if (t === "none") return
    if (!val.related_entity_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "related_entity_id is required when related_entity_type is not none.",
      })
    }
  })

const communicationDraftPayload = z.object({
  subject: z.string().min(2).max(240),
  body: z.string().max(50000).optional(),
  summary: z.string().max(2000).optional(),
  recipient_customer_id: z.string().uuid().optional(),
  related_entity_type: z
    .enum(["work_order", "quote", "invoice", "maintenance_plan", "customer", "equipment", "organization", "prospect"])
    .optional(),
  related_entity_id: z.string().uuid().optional(),
})

export const SafeActionPrepareAnswerSchema = z.discriminatedUnion("action_type", [
  sharedPrepareFields.extend({
    action_type: z.literal("create_follow_up_task"),
    proposed_payload: followUpPayload,
  }),
  sharedPrepareFields.extend({
    action_type: z.literal("create_internal_note"),
    proposed_payload: internalNotePayload,
  }),
  sharedPrepareFields.extend({
    action_type: z.literal("create_reminder"),
    proposed_payload: reminderPayload,
  }),
  sharedPrepareFields.extend({
    action_type: z.literal("create_communication_draft"),
    proposed_payload: communicationDraftPayload,
  }),
])

export type SafeActionPrepareAnswer = z.infer<typeof SafeActionPrepareAnswerSchema>

export function parseRemindAtIso(raw: string): Date | null {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** Reconstruct a validated proposal from `aiden_pending_actions` + JSON payload. */
export function parsePendingSafeAction(row: {
  action_type: string
  title: string
  explanation: string
  proposed_payload: unknown
  risk_level: string
}): SafeActionPrepareAnswer | null {
  const merged = {
    action_type: row.action_type,
    title: row.title,
    explanation: row.explanation,
    risk_level: row.risk_level,
    confirmation_required: true as const,
    proposed_payload: row.proposed_payload,
  }
  const parsed = SafeActionPrepareAnswerSchema.safeParse(merged)
  return parsed.success ? parsed.data : null
}
