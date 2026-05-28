/** Safe message personalization — Phase 4B. No fabricated claims. */

import {
  VOICE_DROP_ALLOWED_PERSONALIZATION_TOKENS,
  type VoiceDropPersonalizationToken,
} from "@/lib/voice/voice-drops/types"

export type PersonalizationContext = Partial<Record<VoiceDropPersonalizationToken, string | null>>

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g

const FALLBACKS: Record<VoiceDropPersonalizationToken, string> = {
  first_name: "there",
  company_name: "your company",
  assigned_rep: "our team",
  service_type: "your service request",
  callback_number: "our main line",
  appointment_window: "a convenient time",
  last_interaction_summary: "your recent inquiry",
}

export function extractPersonalizationTokens(template: string): VoiceDropPersonalizationToken[] {
  const found = new Set<VoiceDropPersonalizationToken>()
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const key = match[1] as VoiceDropPersonalizationToken
    if ((VOICE_DROP_ALLOWED_PERSONALIZATION_TOKENS as readonly string[]).includes(key)) {
      found.add(key)
    }
  }
  return [...found]
}

export function renderPersonalizedMessage(
  template: string,
  context: PersonalizationContext,
): { rendered: string; missingTokens: VoiceDropPersonalizationToken[]; unsupportedTokens: string[] } {
  const missingTokens: VoiceDropPersonalizationToken[] = []
  const unsupportedTokens: string[] = []

  const rendered = template.replace(TOKEN_PATTERN, (_full, rawKey: string) => {
    const key = rawKey as VoiceDropPersonalizationToken
    if (!(VOICE_DROP_ALLOWED_PERSONALIZATION_TOKENS as readonly string[]).includes(key)) {
      unsupportedTokens.push(rawKey)
      return `[${rawKey}]`
    }
    const value = context[key]?.trim()
    if (!value) {
      missingTokens.push(key)
      return FALLBACKS[key]
    }
    return value
  })

  return { rendered, missingTokens, unsupportedTokens }
}

export function validateMessageTemplate(template: string): { ok: boolean; violations: string[] } {
  const violations: string[] = []
  if (!template.trim()) violations.push("Message template is empty.")
  if (/\b(guaranteed|urgent action required|act now|limited time only)\b/i.test(template)) {
    violations.push("Template contains misleading urgency language.")
  }
  if (/\b(i booked|appointment confirmed|we charged|contract signed)\b/i.test(template)) {
    violations.push("Template contains unsupported autonomous claims.")
  }
  if (template.length > 1000) violations.push("Template exceeds 1000 character limit.")
  return { ok: violations.length === 0, violations }
}
