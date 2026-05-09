import type { Recommendation } from "./types"

/**
 * AI Operational Assistant Phase 2 — narration prompt.
 *
 * Pure prompt builders used by the `/ai-ops/[key]/narrate` endpoint.
 * The deterministic recommendation is the source of truth — the LLM
 * only rewrites the explanation in plain operational English and
 * suggests 2–4 short next steps. **No record IDs are leaked into the
 * prompt** — every entity is referenced by label only, mirroring the
 * "no raw UUIDs in UI" guardrail.
 */

export const AI_OPS_NARRATION_SCHEMA_VERSION = "ai_ops_narration_v1"

export const AI_OPS_NARRATION_SYSTEM_PROMPT = `
You are Equipify's AI Operations assistant, helping a service-business
manager triage operational issues. You receive a single deterministic
recommendation and your job is to rewrite the explanation in clear,
calm, operational English and propose 2 to 4 short next steps the
manager could take inside Equipify.

Hard rules:
- Do NOT invent records, customer names, dollar amounts, or numbers
  not in the input.
- Do NOT propose actions that mutate records (paying invoices,
  marking work orders complete, sending automatic emails). Suggest
  human-in-the-loop steps only.
- Do NOT write a customer-facing email body. The user has separate
  draft tooling for that.
- Use plain language. Avoid hype. Avoid emoji.
- Each next step is a short imperative ("Open the prospect drawer
  and confirm the contact email", "Schedule a phone call", etc.).
- Keep the explanation under 60 words.
- Keep next steps under 12 words each.

Respond with a single valid JSON object only, with this shape:
{
  "headline": string,            // <= 60 chars
  "explanation": string,         // 1-2 sentences, <= 60 words
  "next_steps": string[]         // 2-4 short imperatives
}
`.trim()

export function buildAiOpsNarrationUserPrompt(rec: Recommendation): string {
  const lines: string[] = []
  lines.push(`Category: ${rec.category}`)
  lines.push(`Rule: ${rec.ruleId}`)
  if (rec.insightTheme) {
    lines.push(`Insight theme: ${rec.insightTheme}`)
  }
  if (rec.sourceModule) {
    lines.push(`Source module: ${rec.sourceModule}`)
  }
  lines.push(`Priority: ${rec.priority}`)
  if (typeof rec.confidenceScore === "number") {
    lines.push(`Confidence score (0-100): ${rec.confidenceScore}`)
  }
  lines.push(`Title: ${rec.title}`)
  lines.push(`Deterministic explanation: ${rec.explanation}`)
  if (rec.suggestedNextStep) {
    lines.push(`Suggested next step (operator hint): ${rec.suggestedNextStep}`)
  }
  if (rec.sourceSignals?.length) {
    lines.push(`Signals: ${rec.sourceSignals.join(", ")}`)
  }
  if (rec.entity?.label) {
    lines.push(`Affected record: ${rec.entity.type} "${rec.entity.label}"`)
  }
  if (rec.metric) {
    lines.push(`Metric: ${rec.metric.label} = ${rec.metric.value}`)
  }
  if (rec.anchorIso) {
    lines.push(`Anchor timestamp (ISO): ${rec.anchorIso}`)
  }
  lines.push("")
  lines.push(
    "Rewrite the explanation in plain English and propose 2 to 4 short next steps a service manager could take.",
  )
  return lines.join("\n")
}
