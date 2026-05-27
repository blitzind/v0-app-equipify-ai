/** Output validation for Signal Copilot — reject unsupported claims. */

import {
  SIGNAL_COPILOT_DISCLAIMER,
  type SignalCopilotAiModelOutput,
  type SignalCopilotCompanyNarrative,
  type SignalCopilotValidationResult,
  type SignalCopilotWhyNowResult,
} from "@/lib/growth/signals/ai/signal-copilot-types"

const UNSUPPORTED_CLAIM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(signed|closed deal|purchased|bought our|selected vendor)\b/i, reason: "unsupported purchase claim" },
  { pattern: /\b(raised \$|series [a-e]|funding round|venture capital)\b/i, reason: "unsupported funding claim" },
  { pattern: /\b(budget approved|allocated budget|confirmed budget)\b/i, reason: "unsupported budget claim" },
  { pattern: /\b(guaranteed|definitely|will buy|ready to buy|purchase intent confirmed)\b/i, reason: "unsupported buying certainty" },
  { pattern: /\b(contract awarded|won the bid|procurement approved)\b/i, reason: "unsupported contract claim" },
  { pattern: /\b(\d{2,}\s*employees|\d+\s*million|\$\d+[mb])\b/i, reason: "unsupported financial/headcount claim" },
  { pattern: /\b(auto[- ]?enroll|send email|launch sequence|crm update)\b/i, reason: "autonomous action language" },
]

const INTERNAL_LEAK_PATTERNS = [
  /raw_payload/i,
  /provider_debug/i,
  /person_external_id/i,
  /ingestion_queue/i,
  /service_role/i,
]

function scanText(text: string, errors: string[], field: string): void {
  for (const { pattern, reason } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) errors.push(`${field}: ${reason}`)
  }
  for (const pattern of INTERNAL_LEAK_PATTERNS) {
    if (pattern.test(text)) errors.push(`${field}: internal metadata leakage`)
  }
}

function clampStrings(values: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, max)
    .map((value) => value.trim().slice(0, maxLen))
}

function normalizeConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "high" || value === "medium" || value === "low") return value
  return "medium"
}

export function validateSignalCopilotAiOutput(raw: unknown): SignalCopilotValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["AI output must be a JSON object."] }
  }

  const record = raw as Record<string, unknown>
  const errors: string[] = []

  const short_summary =
    typeof record.short_summary === "string" ? record.short_summary.trim().slice(0, 320) : ""
  const detailed_summary =
    typeof record.detailed_summary === "string" ? record.detailed_summary.trim().slice(0, 800) : ""

  if (!short_summary) errors.push("short_summary is required")
  if (!detailed_summary) errors.push("detailed_summary is required")

  const reasoning_bullets = clampStrings(record.reasoning_bullets, 6, 240)
  const suggested_operator_focus = clampStrings(record.suggested_operator_focus, 6, 160)

  if (reasoning_bullets.length === 0) errors.push("reasoning_bullets must include evidence-backed bullets")

  for (const text of [short_summary, detailed_summary, ...reasoning_bullets, ...suggested_operator_focus]) {
    scanText(text, errors, "output")
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    errors: [],
    sanitized: {
      short_summary,
      detailed_summary,
      reasoning_bullets,
      suggested_operator_focus,
      confidence: normalizeConfidence(record.confidence),
    },
  }
}

export function validateSignalCopilotNarrative(narrative: SignalCopilotCompanyNarrative): SignalCopilotValidationResult {
  const errors: string[] = []
  for (const text of [
    narrative.short_summary,
    narrative.detailed_summary,
    ...narrative.reasoning_bullets,
    ...narrative.suggested_operator_focus,
  ]) {
    scanText(text, errors, "narrative")
  }
  if (narrative.disclaimer !== SIGNAL_COPILOT_DISCLAIMER) {
    errors.push("disclaimer must be present")
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] }
}

export function validateWhyNowBullets(bullets: string[]): SignalCopilotValidationResult {
  const errors: string[] = []
  if (bullets.length === 0) errors.push("why_now requires at least one bullet when signals exist")
  if (bullets.length > 4) errors.push("why_now exceeds max bullet count")
  for (const bullet of bullets) scanText(bullet, errors, "why_now")
  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [] }
}

export function mapValidatedAiToNarrative(
  sanitized: SignalCopilotAiModelOutput,
): SignalCopilotCompanyNarrative {
  return {
    qa_marker: "growth-signal-ai-insights-v1",
    short_summary: sanitized.short_summary,
    detailed_summary: sanitized.detailed_summary,
    confidence: sanitized.confidence,
    reasoning_bullets: sanitized.reasoning_bullets,
    suggested_operator_focus: sanitized.suggested_operator_focus,
    source: "ai_validated",
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  }
}

export function sanitizeWhyNowResult(result: SignalCopilotWhyNowResult): SignalCopilotWhyNowResult {
  return {
    ...result,
    bullets: result.bullets.slice(0, 4).map((bullet) => bullet.slice(0, 240)),
  }
}
