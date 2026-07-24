/**
 * AVA-COMPANY-INTELLIGENCE-INTEGRATION-1A — Minimal structured output contract.
 */

import { z } from "zod"
import type { AvaReasoningResult } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export const avaReasoningResultSchema = z.object({
  decision: z.enum(["pursue", "hold", "reject"]),
  rationale: z.string().min(1).max(2000),
  strongestAngle: z.string().max(800).nullable(),
  recommendedContact: z
    .object({
      contactId: z.string().max(120).nullable(),
      name: z.string().max(200).nullable(),
      title: z.string().max(200).nullable(),
      reason: z.string().min(1).max(600),
    })
    .nullable(),
  missingInformation: z.array(z.string().min(1).max(400)).max(12),
  email: z
    .object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(4000),
    })
    .nullable(),
  evidenceReferences: z.array(z.string().min(1).max(400)).max(16),
})

export type AvaReasoningModelOutput = z.infer<typeof avaReasoningResultSchema>

export const AVA_REASONING_JSON_CONTRACT = [
  "REQUIRED JSON SHAPE (all keys required; use null where noted):",
  JSON.stringify(
    {
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
  "When decision is hold or reject, email must be null.",
  "Do not invent contacts that were not supplied.",
  "Do not mention internal scores, AI architecture, Company Intelligence, DataMoon, or research systems in the email.",
].join("\n")

export function normalizeAvaReasoningResult(raw: AvaReasoningModelOutput): AvaReasoningResult {
  const decision = raw.decision
  const email =
    decision === "pursue" && raw.email?.subject?.trim() && raw.email?.body?.trim()
      ? {
          subject: raw.email.subject.trim(),
          body: raw.email.body.trim(),
        }
      : null

  return {
    decision,
    rationale: raw.rationale.trim(),
    strongestAngle: decision === "pursue" ? raw.strongestAngle?.trim() || null : raw.strongestAngle?.trim() || null,
    recommendedContact: raw.recommendedContact
      ? {
          contactId: raw.recommendedContact.contactId?.trim() || null,
          name: raw.recommendedContact.name?.trim() || null,
          title: raw.recommendedContact.title?.trim() || null,
          reason: raw.recommendedContact.reason.trim(),
        }
      : null,
    missingInformation: raw.missingInformation.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    email: decision === "pursue" ? email : null,
    evidenceReferences: raw.evidenceReferences.map((s) => s.trim()).filter(Boolean).slice(0, 16),
  }
}

/** Enforce: hold/reject never keep a draft. */
export function enforceAvaReasoningEmailPolicy(result: AvaReasoningResult): AvaReasoningResult {
  if (result.decision !== "pursue") {
    return { ...result, email: null }
  }
  return result
}
