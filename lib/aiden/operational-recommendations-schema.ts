import { z } from "zod"

export const OperationalModuleContextSchema = z.enum([
  "dashboard",
  "work_orders",
  "service_schedule",
  "equipment",
  "customers",
  "maintenance_plans",
])

export type OperationalModuleContext = z.infer<typeof OperationalModuleContextSchema>

export const AidenOperationalRecommendationsAnswerSchema = z.object({
  overview: z.string().optional(),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        category: z.string(),
        explanation: z.string(),
        suggestedNextStep: z.string(),
        relatedModule: OperationalModuleContextSchema,
        relatedRecordIds: z.array(z.string().uuid()).max(20).optional(),
      }),
    )
    .max(12),
})

export type AidenOperationalRecommendationsAnswer = z.infer<
  typeof AidenOperationalRecommendationsAnswerSchema
>
