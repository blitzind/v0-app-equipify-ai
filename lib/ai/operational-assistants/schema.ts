import { z } from "zod"

export const operationalAlertSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).optional(),
  title: z.string(),
  detail: z.string().optional(),
})

export const operationalRecommendationSchema = z.object({
  title: z.string(),
  rationale: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
})

export const operationalActionSchema = z.object({
  label: z.string(),
  href: z.string().optional(),
  kind: z.enum(["navigate", "create", "review"]).optional(),
})

/** Structured card output shared by all operational assistants (router-validated JSON). */
export const operationalAssistantCardSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  alerts: z.array(operationalAlertSchema),
  recommendations: z.array(operationalRecommendationSchema),
  actions: z.array(operationalActionSchema),
})

export type OperationalAssistantCard = z.infer<typeof operationalAssistantCardSchema>
