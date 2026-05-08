import { z } from "zod"
import { AidenProposedActionSchema } from "@/lib/aiden/actions/types"

export const AIDEN_CHAT_MESSAGE_ROLES = ["user", "assistant"] as const
export type AidenChatMessageRole = (typeof AIDEN_CHAT_MESSAGE_ROLES)[number]

export const AIDEN_REQUEST_CLASSIFICATIONS = [
  "supported_now",
  "needs_workaround",
  "not_built_feature_candidate",
  "not_relevant_to_equipify",
  "bug_or_support_issue",
] as const

export const AidenChatMessageSchema = z.object({
  role: z.enum(AIDEN_CHAT_MESSAGE_ROLES),
  content: z.string().trim().min(1).max(4000),
})

export const AidenAnswerActionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(300),
})

export const AidenFeatureRequestDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  originalQuestion: z.string().trim().min(1).max(1000),
  module: z.string().trim().max(120).optional().nullable(),
  currentPath: z.string().trim().max(300).optional().nullable(),
  currentLimitation: z.string().trim().max(600).optional().nullable(),
  suggestedImprovement: z.string().trim().max(800).optional().nullable(),
  businessValue: z.string().trim().max(800).optional().nullable(),
})

export const AidenAnswerSchema = z
  .object({
    message: z.string().trim().min(1).optional(),
    answer: z.string().trim().min(1).optional(),
    classification: z.enum(AIDEN_REQUEST_CLASSIFICATIONS).default("supported_now"),
    steps: z.array(z.string().trim().min(1)).max(8).default([]),
    relatedRoutes: z.array(z.string().trim().min(1)).max(6).default([]),
    actions: z.array(AidenAnswerActionSchema).max(4).default([]),
    proposedAction: AidenProposedActionSchema.optional().nullable().default(null),
    featureRequestDraft: AidenFeatureRequestDraftSchema.optional().nullable().default(null),
    permissionNote: z.string().trim().nullable().default(null),
    limitation: z.string().trim().nullable().default(null),
    unresolved: z.boolean().default(false),
    howToMode: z.boolean().default(false),
  })
  .transform((value) => ({
    ...value,
    answer: value.answer ?? value.message ?? "I don't see that functionality documented in Equipify yet.",
    message: value.message ?? value.answer ?? "I don't see that functionality documented in Equipify yet.",
  }))

export type AidenChatMessage = z.infer<typeof AidenChatMessageSchema>
export type AidenAnswer = z.infer<typeof AidenAnswerSchema>
export type AidenAnswerAction = z.infer<typeof AidenAnswerActionSchema>
export type AidenFeatureRequestDraft = z.infer<typeof AidenFeatureRequestDraftSchema>
export type AidenRequestClassification = (typeof AIDEN_REQUEST_CLASSIFICATIONS)[number]
