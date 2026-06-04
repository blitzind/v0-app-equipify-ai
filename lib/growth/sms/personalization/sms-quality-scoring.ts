/** SMS personalization quality scoring (Phase 5.3F). Client-safe. */

import { isGenericSmsOpener } from "@/lib/growth/sms/personalization/sms-opening-hooks"
import { hasSmsBlastLanguage } from "@/lib/growth/sms/personalization/sms-memory-awareness"
import type {
  SmsPersonalizationDraft,
  SmsQualityScore,
} from "@/lib/growth/sms/personalization/sms-personalization-types"
import type { OutreachContextQualityMetadata, MemoryQualityMetadata } from "@/lib/growth/outreach/personalization/personalization-types"

export function estimateSmsSegments(charCount: number): number {
  if (charCount <= 160) return 1
  return Math.ceil(charCount / 153)
}

export function trimSmsToMaxChars(body: string, maxChars: number): string {
  const trimmed = body.trim().replace(/\s+/g, " ")
  if (trimmed.length <= maxChars) return trimmed
  const cut = trimmed.slice(0, maxChars - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export function assembleSmsBody(hook: string, cta: string, maxChars: number): SmsPersonalizationDraft {
  const combined = `${hook.trim()} ${cta.trim()}`.replace(/\s+/g, " ").trim()
  const body = trimSmsToMaxChars(combined, maxChars)
  return {
    body,
    charCount: body.length,
    segmentCount: estimateSmsSegments(body.length),
  }
}

export function scoreSmsPersonalizationQuality(input: {
  draft: SmsPersonalizationDraft
  hookText: string
  maxChars: number
  contextQuality?: OutreachContextQualityMetadata
  memoryQuality?: MemoryQualityMetadata
}): SmsQualityScore {
  const { draft, hookText, maxChars, contextQuality, memoryQuality } = input

  const specificity =
    hookText.includes("?") && !isGenericSmsOpener(hookText) ? 85 : isGenericSmsOpener(hookText) ? 25 : 55
  const conversationalTone = hasSmsBlastLanguage(draft.body) ? 20 : draft.body.includes("?") ? 90 : 70
  const charFit = draft.charCount <= maxChars ? (draft.charCount <= 160 ? 95 : 80) : 40
  const nonGeneric = isGenericSmsOpener(hookText) || hasSmsBlastLanguage(draft.body) ? 20 : 85
  const memoryAlignment = memoryQuality?.memoryUtilizationPercentage ?? 0
  const contextAlignment = contextQuality?.utilizationPercentage ?? 0

  const overall = Math.round(
    specificity * 0.25 +
      conversationalTone * 0.2 +
      charFit * 0.15 +
      nonGeneric * 0.15 +
      memoryAlignment * 0.125 +
      contextAlignment * 0.125,
  )

  return {
    overall,
    specificity,
    conversationalTone,
    charFit,
    nonGeneric,
    memoryAlignment,
    contextAlignment,
  }
}
