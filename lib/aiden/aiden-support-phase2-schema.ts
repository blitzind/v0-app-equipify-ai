import { z } from "zod"
import { AidenFeatureRequestDraftSchema } from "@/lib/aiden/aiden-response-rules"

const CLASSIFICATIONS = [
  "supported_now",
  "needs_workaround",
  "not_built_feature_candidate",
  "not_relevant_to_equipify",
  "bug_or_support_issue",
] as const

/**
 * Phase 2 — support answers plus optional feature-request draft when the product does not support the ask yet.
 * No actions, proposedAction, or navigation payloads.
 */
export const AidenSupportPhase2AnswerSchema = z
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
    featureRequestDraft: AidenFeatureRequestDraftSchema.nullable().optional().default(null),
  })
  .transform((value) => ({
    ...value,
    answer: value.answer ?? value.message ?? "I don't see that documented in Equipify yet.",
    message: value.message ?? value.answer ?? "I don't see that documented in Equipify yet.",
    featureRequestDraft: value.featureRequestDraft ?? null,
  }))

export type AidenSupportPhase2Answer = z.infer<typeof AidenSupportPhase2AnswerSchema>
