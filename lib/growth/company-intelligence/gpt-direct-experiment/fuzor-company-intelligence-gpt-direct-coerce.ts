/**
 * Coerce verbose GPT-direct JSON into schema bounds before normalize.
 * Experiment-only — production pipeline unchanged.
 */

import {
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"
import type { FuzorCompanyBusinessUnderstanding } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

function asString(value: unknown, max: number, fallback = "Unknown"): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
}

function asNullableString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function coerceGptDirectCompanyUnderstanding(raw: unknown): FuzorCompanyBusinessUnderstanding | null {
  const root = asObject(raw)
  const revenueModel = asObject(root.revenueModel)
  const productsAndServices = asObject(root.productsAndServices)
  const operationalModel = asObject(root.operationalModel)
  const customers = asObject(root.customers)
  const industriesServed = asObject(root.industriesServed)
  const operationalChallenges = asObject(root.operationalChallenges)
  const companyStrengths = asObject(root.companyStrengths)

  const challengesRaw = Array.isArray(operationalChallenges.challenges)
    ? operationalChallenges.challenges
    : []

  const coerced = {
    executiveSummary: asString(root.executiveSummary, 4000),
    revenueModel: {
      summary: asString(revenueModel.summary, 2000),
      models: asStringArray(revenueModel.models, 12, 120),
      evidence: asStringArray(revenueModel.evidence, 12, 500),
    },
    productsAndServices: {
      offerings: asStringArray(productsAndServices.offerings, 24, 300),
      notes: asNullableString(productsAndServices.notes, 1500),
      evidence: asStringArray(productsAndServices.evidence, 12, 500),
    },
    operationalModel: {
      summary: asString(operationalModel.summary, 2000),
      characteristics: asStringArray(operationalModel.characteristics, 16, 200),
      evidence: asStringArray(operationalModel.evidence, 12, 500),
    },
    customers: {
      summary: asString(customers.summary, 2000),
      segments: asStringArray(customers.segments, 16, 200),
      evidence: asStringArray(customers.evidence, 12, 500),
    },
    industriesServed: {
      industries: asStringArray(industriesServed.industries, 16, 200),
      evidence: asStringArray(industriesServed.evidence, 12, 500),
    },
    operationalChallenges: {
      challenges: challengesRaw.slice(0, 12).map((item) => {
        const challenge = asObject(item)
        return {
          challenge: asString(challenge.challenge, 400),
          why: asString(challenge.why, 800),
          evidence: asStringArray(challenge.evidence, 8, 500),
        }
      }),
    },
    companyStrengths: {
      strengths: asStringArray(companyStrengths.strengths, 12, 400),
      evidence: asStringArray(companyStrengths.evidence, 12, 500),
    },
    unknowns: asStringArray(root.unknowns, 24, 300),
    evidenceUsed: asStringArray(root.evidenceUsed, 24, 500),
    evidenceWeakness: asNullableString(root.evidenceWeakness, 1500),
  }

  const parsed = fuzorCompanyBusinessUnderstandingSchema.safeParse(coerced)
  if (!parsed.success) return null
  return normalizeFuzorCompanyBusinessUnderstanding(parsed.data)
}
