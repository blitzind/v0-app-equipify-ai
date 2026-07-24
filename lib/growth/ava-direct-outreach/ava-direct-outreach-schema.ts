/**
 * AVA-SIMPLE-OUTREACH-2A — Zod schema for one structured model call.
 */

import { z } from "zod"
import type { AvaDirectOutreachResult } from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-types"

export const avaDirectOutreachResultSchema = z.object({
  decision: z.enum(["outreach", "reject", "needs_more_research"]),
  confidence: z.number().min(0).max(1),
  fitSummary: z.string().min(1).max(1200),
  supportingReasons: z.array(z.string().min(1).max(400)).max(8),
  concerns: z.array(z.string().min(1).max(400)).max(8),
  recommendedContactRole: z.string().max(200).nullable(),
  salesAngle: z.string().max(600).nullable(),
  email: z
    .object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(4000),
    })
    .nullable(),
  evidenceUsed: z.array(z.string().min(1).max(400)).max(12),
  missingInformation: z.array(z.string().min(1).max(400)).max(12),
})

export type AvaDirectOutreachModelOutput = z.infer<typeof avaDirectOutreachResultSchema>

/**
 * Machine-readable output contract referenced by the system prompt.
 * Kept next to Zod so the contract cannot drift from validation.
 */
export const AVA_DIRECT_OUTREACH_JSON_CONTRACT = [
  "REQUIRED JSON SHAPE (all keys required; use null where noted):",
  JSON.stringify(
    {
      decision: "outreach | reject | needs_more_research",
      confidence: "number 0..1",
      fitSummary: "string",
      supportingReasons: ["string"],
      concerns: ["string"],
      recommendedContactRole: "string | null",
      salesAngle: "string | null",
      email: { subject: "string", body: "string" },
      evidenceUsed: ["string"],
      missingInformation: ["string"],
    },
    null,
    2,
  ),
  "When decision is reject or needs_more_research, email must be null.",
  "Do not use alternate keys (e.g. rationale, reasoning).",
].join("\n")

export function normalizeAvaDirectOutreachResult(
  raw: AvaDirectOutreachModelOutput,
): AvaDirectOutreachResult {
  const decision = raw.decision
  const email =
    decision === "outreach" && raw.email?.subject?.trim() && raw.email?.body?.trim()
      ? {
          subject: raw.email.subject.trim(),
          body: raw.email.body.trim(),
        }
      : null

  return {
    decision,
    confidence: Math.max(0, Math.min(1, raw.confidence)),
    fitSummary: raw.fitSummary.trim(),
    supportingReasons: raw.supportingReasons.map((s) => s.trim()).filter(Boolean).slice(0, 8),
    concerns: raw.concerns.map((s) => s.trim()).filter(Boolean).slice(0, 8),
    recommendedContactRole: raw.recommendedContactRole?.trim() || null,
    salesAngle: raw.salesAngle?.trim() || null,
    // Reject / needs_more_research must never fabricate a sendable email.
    email: decision === "outreach" ? email : null,
    evidenceUsed: raw.evidenceUsed.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    missingInformation: raw.missingInformation.map((s) => s.trim()).filter(Boolean).slice(0, 12),
  }
}
