/** Compliance guardrails for AI copilot suggestions — Phase 3A. */

import type { VoiceAiCopilotGenerationDraft } from "@/lib/voice/ai-copilot/types"

const PROHIBITED_AUTONOMOUS_PATTERNS = [
  /\b(auto(?:matically)?\s+(?:send|book|transfer|update|accept|submit|schedule|email|sms|text))\b/i,
  /\b(let (?:the )?ai (?:handle|send|book|transfer|update))\b/i,
  /\b(transfer (?:the )?call (?:now|immediately|for them))\b/i,
  /\b(update (?:the )?crm (?:now|automatically|for them))\b/i,
  /\b(send (?:the )?(?:email|sms|text) (?:now|automatically|for them))\b/i,
  /\b(book (?:the )?(?:appointment|meeting) (?:now|automatically|for them))\b/i,
  /\b(ai (?:will|can|should) (?:speak|respond|act|handle))\b/i,
  /\b(do not (?:disclose|mention) (?:recording|ai))\b/i,
  /\b(bypass (?:consent|opt[- ]?out|dnc))\b/i,
  /\b(ignore (?:opt[- ]?out|dnc|consent))\b/i,
  /\b(guaranteed compliant|legally compliant|100% compliant)\b/i,
  /\b(promise (?:this )?price|guarantee (?:this )?(?:price|rate|discount))\b/i,
  /\b(definitely (?:legal|compliant|approved))\b/i,
  /\b(deceptive|mislead|hide (?:the )?(?:fee|cost|price))\b/i,
]

const SECRET_LEAKAGE_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{10,})\b/,
  /\b(api[_-]?key\s*[:=]\s*\S+)/i,
  /\b(bearer\s+[a-zA-Z0-9._-]{20,})\b/i,
]

export type GuardrailViolation = {
  code: string
  message: string
}

export function detectGuardrailViolations(text: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = []
  const combined = text.trim()
  if (!combined) return [{ code: "empty_content", message: "Suggestion content is empty." }]

  for (const pattern of PROHIBITED_AUTONOMOUS_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push({
        code: "prohibited_autonomous_action",
        message: "Suggestion implies autonomous action or prohibited behavior.",
      })
      break
    }
  }

  for (const pattern of SECRET_LEAKAGE_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push({ code: "secret_leakage", message: "Suggestion may contain sensitive credentials." })
      break
    }
  }

  return violations
}

export function passesEvidenceRequirement(draft: VoiceAiCopilotGenerationDraft, knownEvidence: string[]): boolean {
  const evidence = draft.evidenceText.trim()
  if (!evidence || evidence.length < 8) return false

  const normalizedEvidence = evidence.toLowerCase()
  return knownEvidence.some((item) => {
    const normalized = item.trim().toLowerCase()
    if (!normalized) return false
    return normalizedEvidence.includes(normalized.slice(0, Math.min(normalized.length, 80)))
      || normalized.includes(normalizedEvidence.slice(0, Math.min(normalizedEvidence.length, 80)))
  })
}

export function filterGuardedCopilotDrafts(
  drafts: VoiceAiCopilotGenerationDraft[],
  knownEvidence: string[],
): VoiceAiCopilotGenerationDraft[] {
  return drafts.filter((draft) => {
    const combined = `${draft.title}\n${draft.body}\n${draft.evidenceText}`
    if (detectGuardrailViolations(combined).length > 0) return false
    return passesEvidenceRequirement(draft, knownEvidence)
  })
}
