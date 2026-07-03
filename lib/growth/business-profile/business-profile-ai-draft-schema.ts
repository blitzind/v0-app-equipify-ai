/** GE-AIOS-BUSINESS-PROFILE-1B — AI Business Profile draft schema (client-safe). */

import { z } from "zod"

export const businessProfileAiDraftModelSchema = z.object({
  company: z.object({
    shortDescription: z.string().min(10).max(1200),
    productsServices: z.array(z.string().min(1).max(300)).min(1).max(12),
    businessModel: z.string().min(3).max(500),
    primaryValueProposition: z.string().min(10).max(800),
  }),
  idealCustomers: z.object({
    targetIndustries: z.array(z.string().min(1).max(200)).min(1).max(12),
    companySizeRanges: z.array(z.string().min(1).max(80)).min(1).max(8),
    geography: z.array(z.string().min(1).max(200)).min(1).max(8),
    buyerPersonas: z.array(z.string().min(1).max(120)).min(1).max(12),
    disqualifiers: z.array(z.string().min(1).max(200)).min(1).max(10),
  }),
  problemsAndTriggers: z.object({
    painPoints: z.array(z.string().min(3).max(300)).min(1).max(12),
    buyingTriggers: z.array(z.string().min(3).max(300)).min(1).max(12),
    competitorsAlternatives: z.array(z.string().min(1).max(200)).min(1).max(10),
    keywords: z.array(z.string().min(1).max(120)).min(1).max(20),
    negativeKeywords: z.array(z.string().min(1).max(120)).min(1).max(12),
  }),
  salesAndMarketing: z.object({
    averageDealSize: z.string().max(200).nullable().optional(),
    salesCycleEstimate: z.string().max(200).nullable().optional(),
    messagingAngles: z.array(z.string().min(3).max(300)).min(1).max(10),
    qualificationCriteria: z.array(z.string().min(3).max(300)).min(1).max(10),
  }),
  confidence: z.object({
    score: z.number().min(0).max(1),
    assumptions: z.array(z.string().min(3).max(500)).min(1).max(12),
    missingInformation: z.array(z.string().min(3).max(300)).max(12),
  }),
})

export type BusinessProfileAiDraftModel = z.infer<typeof businessProfileAiDraftModelSchema>
