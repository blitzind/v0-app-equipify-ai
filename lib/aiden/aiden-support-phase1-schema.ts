import { z } from "zod"

const CLASSIFICATIONS = [
  "supported_now",
  "needs_workaround",
  "not_built_feature_candidate",
  "not_relevant_to_equipify",
  "bug_or_support_issue",
] as const

/**
 * Phase 1 — safe support-only answers. No proposedAction, actions, or featureRequestDraft.
 */
export const AidenSupportPhase1AnswerSchema = z
  .object({
    answer: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    classification: z.enum(CLASSIFICATIONS).default("supported_now"),
    steps: z.array(z.string().trim().min(1)).max(8).default([]),
    relatedRoutes: z.array(z.string().trim().min(1)).max(6).default([]),
    permissionNote: z.string().trim().nullable().optional().default(null),
    limitation: z.string().trim().nullable().optional().default(null),
    unresolved: z.boolean().default(false),
    howToMode: z.boolean().default(false),
  })
  .transform((value) => ({
    ...value,
    answer: value.answer ?? value.message ?? "I don't see that documented in Equipify yet.",
    message: value.message ?? value.answer ?? "I don't see that documented in Equipify yet.",
  }))

export type AidenSupportPhase1Answer = z.infer<typeof AidenSupportPhase1AnswerSchema>
