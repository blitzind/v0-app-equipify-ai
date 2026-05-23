import { z } from "zod"
import { GROWTH_AI_COPILOT_GENERATION_TYPES } from "@/lib/growth/ai-copilot-types"
import { GROWTH_AI_COPILOT_PLAYBOOK_RULE_CATEGORIES } from "@/lib/growth/ai-copilot-playbook-types"

const industryScopeSchema = z
  .object({
    appliesGlobally: z.boolean().optional(),
    industries: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .optional()

const trainerProfileSchema = z
  .object({
    name: z.string().optional(),
    role: z.string().optional(),
    organization: z.string().optional(),
    styleNotes: z.string().optional(),
  })
  .optional()

export const growthAiCopilotPlaybookExtractionRuleSchema = z.object({
  category: z.enum(GROWTH_AI_COPILOT_PLAYBOOK_RULE_CATEGORIES),
  title: z.string().min(3).max(120),
  principle: z.string().min(10).max(800),
  appliesTo: z.array(z.enum(GROWTH_AI_COPILOT_GENERATION_TYPES)).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  industryScope: industryScopeSchema,
  trainerProfile: trainerProfileSchema,
})

export const growthAiCopilotPlaybookExtractionSchema = z.object({
  rules: z.array(growthAiCopilotPlaybookExtractionRuleSchema).max(40),
  summary: z.string().max(500).optional(),
})

export type GrowthAiCopilotPlaybookExtractionModel = z.infer<typeof growthAiCopilotPlaybookExtractionSchema>
