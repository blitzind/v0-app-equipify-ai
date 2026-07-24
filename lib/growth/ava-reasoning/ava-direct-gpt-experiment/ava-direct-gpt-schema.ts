/**
 * AVA-DIRECT-GPT-1A — Experimental schema (Ava direct + persistable understanding).
 * Experiment only. Production Ava schema unchanged.
 */

import { z } from "zod"
import {
  avaReasoningResultSchema,
  enforceAvaReasoningEmailPolicy,
  normalizeAvaReasoningResult,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-schema"
import type { AvaReasoningResult } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export const AVA_DIRECT_GPT_1A_QA_MARKER = "ava-direct-gpt-1a-v1" as const

export const avaDirectGptResultSchema = avaReasoningResultSchema.extend({
  companyUnderstanding: z.string().min(1).max(4000),
})

export type AvaDirectGptModelOutput = z.infer<typeof avaDirectGptResultSchema>

export type AvaDirectGptResult = AvaReasoningResult & {
  companyUnderstanding: string
}

export const AVA_DIRECT_GPT_JSON_CONTRACT = [
  "REQUIRED JSON SHAPE (all keys required; use null where noted):",
  JSON.stringify(
    {
      companyUnderstanding:
        "string — your understanding of what the company does and how it operates, derived from the website",
      decision: "pursue | hold | reject",
      rationale: "string",
      strongestAngle: "string | null",
      recommendedContact: {
        contactId: "string | null",
        name: "string | null",
        title: "string | null",
        reason: "string",
      },
      missingInformation: ["string"],
      email: { subject: "string", body: "string" },
      evidenceReferences: ["string"],
    },
    null,
    2,
  ),
  "Derive companyUnderstanding directly from the supplied website text.",
  "When decision is hold or reject, email must be null.",
  "Do not invent contacts that were not supplied.",
].join("\n")

export function normalizeAvaDirectGptResult(raw: AvaDirectGptModelOutput): AvaDirectGptResult {
  const reasoning = enforceAvaReasoningEmailPolicy(normalizeAvaReasoningResult(raw))
  return {
    ...reasoning,
    companyUnderstanding: raw.companyUnderstanding.trim(),
  }
}
