import { z } from "zod"
import {
  GROWTH_AI_COPILOT_REPLY_CLASSIFICATIONS,
  type GrowthAiCopilotClassification,
  type GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"

const callPrepSchema = z
  .object({
    decisionMakerFocus: z.string().optional(),
    knownBlockers: z.array(z.string()).optional(),
    knownObjections: z.array(z.string()).optional(),
    recommendedOpening: z.string().optional(),
    recommendedCta: z.string().optional(),
    riskSummary: z.string().optional(),
  })
  .optional()

export const growthAiCopilotModelSchema = z.object({
  subject: z.string().nullable().optional(),
  content: z.string().min(1),
  classification: z
    .object({
      primary: z.enum(GROWTH_AI_COPILOT_REPLY_CLASSIFICATIONS).or(z.string()).optional(),
      secondary: z.array(z.string()).optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      confidence: z.number().min(0).max(1).optional(),
      callPrep: callPrepSchema,
    })
    .optional(),
})

export type GrowthAiCopilotModelOutput = z.infer<typeof growthAiCopilotModelSchema>

export function mapGrowthAiCopilotModelOutput(
  output: GrowthAiCopilotModelOutput,
  generationType: GrowthAiCopilotGenerationType,
): {
  generatedSubject: string | null
  generatedContent: string
  classification: GrowthAiCopilotClassification
} {
  const classification: GrowthAiCopilotClassification = {
    ...(output.classification ?? {}),
  }

  if (
    generationType === "call_opening" ||
    generationType === "call_objection_response" ||
    generationType === "call_risk_brief"
  ) {
    classification.callPrep = classification.callPrep ?? {
      recommendedOpening: output.content,
    }
  }

  return {
    generatedSubject: output.subject?.trim() ? output.subject.trim() : null,
    generatedContent: output.content.trim(),
    classification,
  }
}
