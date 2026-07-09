/** GE-AIOS-19C-2E — Zod schema for Business Strategy in profile_json (client-safe). */

import { z } from "zod"
import type { BusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"

const stringArraySchema = z.array(z.string())

const domainPrinciplesSchema = z.object({
  principles: stringArraySchema,
  notes: z.string(),
})

export const BusinessStrategyContentSchema: z.ZodType<BusinessStrategyContent> = z.object({
  companyWide: z.object({
    mission: z.string(),
    coreValues: stringArraySchema,
    brandPersonality: z.string(),
  }),
  messaging: z.object({
    elevatorPitch: z.string(),
    tone: z.string(),
    formality: z.string(),
    emailLengthPreference: z.string(),
    ctaPreferences: stringArraySchema,
    wordsToAvoid: stringArraySchema,
    neverSay: stringArraySchema,
  }),
  positioning: z.object({
    competitiveAdvantages: stringArraySchema,
    pricingPhilosophy: z.string(),
    neverCompeteOnPrice: z.boolean().nullable(),
    competitorNotes: stringArraySchema,
  }),
  objections: z.object({
    items: z.array(
      z.object({
        objection: z.string(),
        preferredResponse: z.string(),
      }),
    ),
  }),
  salesPhilosophy: z.object({
    qualificationStandards: stringArraySchema,
    disqualifiers: stringArraySchema,
    discoveryQuestions: stringArraySchema,
    buyingSignals: stringArraySchema,
  }),
  salesAndRelationships: domainPrinciplesSchema,
  marketingAndBrand: domainPrinciplesSchema,
  customerExperience: domainPrinciplesSchema,
  serviceStandards: domainPrinciplesSchema,
  financialGuidelines: domainPrinciplesSchema,
  confidence: z.object({
    score: z.number(),
    assumptions: stringArraySchema,
    missingInformation: stringArraySchema,
  }),
})
