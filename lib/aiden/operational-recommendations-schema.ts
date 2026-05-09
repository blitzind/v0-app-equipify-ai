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

/** Aligns with `InsightTheme` in `lib/ai-ops/types.ts` — kept literal for Zod. */
export const OperationalInsightThemeSchema = z.enum([
  "revenue_opportunity",
  "customer_retention_risk",
  "follow_up_risk",
  "repeat_repair",
  "maintenance_upsell",
  "warranty_window",
  "collections_risk",
  "capacity_risk",
  "inventory_risk",
  "communications_risk",
  "automation_health",
  "certificate_release",
  "dispatch_backlog",
])

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
        insightTheme: OperationalInsightThemeSchema.optional(),
        sourceSignals: z.array(z.string().trim().max(160)).max(12).optional(),
        relatedRecordIds: z.array(z.string().uuid()).max(20).optional(),
      }),
    )
    .max(12),
})

export type AidenOperationalRecommendationsAnswer = z.infer<
  typeof AidenOperationalRecommendationsAnswerSchema
>
