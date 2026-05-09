import { z } from "zod"

export const AidenCustomerSummaryAnswerSchema = z.object({
  profileSummary: z.string(),
  recentWorkSummary: z.string(),
  openWorkSummary: z.string(),
  notableIssues: z.array(z.string()),
  suggestedNextSteps: z.array(z.string()),
})

export type AidenCustomerSummaryAnswer = z.infer<typeof AidenCustomerSummaryAnswerSchema>

export const AidenWorkOrderProductivityAnswerSchema = z.object({
  issueAndStatusSummary: z.string(),
  equipmentSummary: z.string(),
  tasksSummary: z.string(),
  notesSummary: z.string(),
  partsSummary: z.string(),
  missingInformation: z.array(z.string()),
  suggestedNextSteps: z.array(z.string()),
  customerFriendlyUpdateDraft: z.string(),
})

export type AidenWorkOrderProductivityAnswer = z.infer<typeof AidenWorkOrderProductivityAnswerSchema>

export const AidenDraftGenerationAnswerSchema = z.object({
  draft: z.string(),
  copyReminder: z.array(z.string()),
})

export type AidenDraftGenerationAnswer = z.infer<typeof AidenDraftGenerationAnswerSchema>

export const DraftKindSchema = z.enum([
  "service_note",
  "customer_update",
  "quote_explanation",
  "payment_reminder",
  "technician_handoff",
])

export type DraftKind = z.infer<typeof DraftKindSchema>
