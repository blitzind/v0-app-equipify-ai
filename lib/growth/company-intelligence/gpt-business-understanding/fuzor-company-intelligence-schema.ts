/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Zod schema for GPT business understanding.
 */

import { z } from "zod"
import type { FuzorCompanyBusinessUnderstanding } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export const fuzorCompanyBusinessUnderstandingSchema = z.object({
  executiveSummary: z.string().min(1).max(4000),
  revenueModel: z.object({
    summary: z.string().min(1).max(2000),
    models: z.array(z.string().min(1).max(120)).max(12),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  productsAndServices: z.object({
    offerings: z.array(z.string().min(1).max(300)).max(24),
    notes: z.string().max(1500).nullable(),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  operationalModel: z.object({
    summary: z.string().min(1).max(2000),
    characteristics: z.array(z.string().min(1).max(200)).max(16),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  customers: z.object({
    summary: z.string().min(1).max(2000),
    segments: z.array(z.string().min(1).max(200)).max(16),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  industriesServed: z.object({
    industries: z.array(z.string().min(1).max(200)).max(16),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  operationalChallenges: z.object({
    challenges: z
      .array(
        z.object({
          challenge: z.string().min(1).max(400),
          why: z.string().min(1).max(800),
          evidence: z.array(z.string().min(1).max(500)).max(8),
        }),
      )
      .max(12),
  }),
  companyStrengths: z.object({
    strengths: z.array(z.string().min(1).max(400)).max(12),
    evidence: z.array(z.string().min(1).max(500)).max(12),
  }),
  unknowns: z.array(z.string().min(1).max(300)).max(24),
  evidenceUsed: z.array(z.string().min(1).max(500)).max(24),
  evidenceWeakness: z.string().max(1500).nullable(),
})

export type FuzorCompanyBusinessUnderstandingModelOutput = z.infer<
  typeof fuzorCompanyBusinessUnderstandingSchema
>

export const FUZOR_COMPANY_INTELLIGENCE_JSON_CONTRACT = [
  "REQUIRED JSON SHAPE (all keys required; use null / empty arrays where appropriate):",
  JSON.stringify(
    {
      executiveSummary: "string",
      revenueModel: { summary: "string", models: ["string"], evidence: ["string"] },
      productsAndServices: {
        offerings: ["string — prefer company terminology"],
        notes: "string | null",
        evidence: ["string"],
      },
      operationalModel: {
        summary: "string",
        characteristics: ["string"],
        evidence: ["string"],
      },
      customers: { summary: "string", segments: ["string"], evidence: ["string"] },
      industriesServed: { industries: ["string"], evidence: ["string"] },
      operationalChallenges: {
        challenges: [{ challenge: "string", why: "string", evidence: ["string"] }],
      },
      companyStrengths: { strengths: ["string"], evidence: ["string"] },
      unknowns: ["string — genuine gaps only; do not restate known facts"],
      evidenceUsed: ["string"],
      evidenceWeakness: "string | null — only when the business itself cannot be determined from supplied evidence",
    },
    null,
    2,
  ),
  "Do not output confidence percentages, maturity scores, fit scores, or probabilities.",
  "Do not mention Equipify, ICP, sales fit, or software recommendations.",
].join("\n")

export function normalizeFuzorCompanyBusinessUnderstanding(
  raw: FuzorCompanyBusinessUnderstandingModelOutput,
): FuzorCompanyBusinessUnderstanding {
  return {
    executiveSummary: raw.executiveSummary.trim(),
    revenueModel: {
      summary: raw.revenueModel.summary.trim(),
      models: raw.revenueModel.models.map((s) => s.trim()).filter(Boolean).slice(0, 12),
      evidence: raw.revenueModel.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    productsAndServices: {
      offerings: raw.productsAndServices.offerings.map((s) => s.trim()).filter(Boolean).slice(0, 24),
      notes: raw.productsAndServices.notes?.trim() || null,
      evidence: raw.productsAndServices.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    operationalModel: {
      summary: raw.operationalModel.summary.trim(),
      characteristics: raw.operationalModel.characteristics
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 16),
      evidence: raw.operationalModel.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    customers: {
      summary: raw.customers.summary.trim(),
      segments: raw.customers.segments.map((s) => s.trim()).filter(Boolean).slice(0, 16),
      evidence: raw.customers.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    industriesServed: {
      industries: raw.industriesServed.industries.map((s) => s.trim()).filter(Boolean).slice(0, 16),
      evidence: raw.industriesServed.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    operationalChallenges: {
      challenges: raw.operationalChallenges.challenges
        .map((c) => ({
          challenge: c.challenge.trim(),
          why: c.why.trim(),
          evidence: c.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 8),
        }))
        .filter((c) => c.challenge && c.why)
        .slice(0, 12),
    },
    companyStrengths: {
      strengths: raw.companyStrengths.strengths.map((s) => s.trim()).filter(Boolean).slice(0, 12),
      evidence: raw.companyStrengths.evidence.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    },
    unknowns: raw.unknowns.map((s) => s.trim()).filter(Boolean).slice(0, 24),
    evidenceUsed: raw.evidenceUsed.map((s) => s.trim()).filter(Boolean).slice(0, 24),
    evidenceWeakness: raw.evidenceWeakness?.trim() || null,
  }
}
