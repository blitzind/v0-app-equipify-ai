/** CTA quality evaluation for Apollo outreach content (Phase 11C). */

import { isWeakGenericCta } from "@/lib/growth/outreach/personalization/cta-intelligence"

import type { ApolloCtaQualityResult } from "@/lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"

const GENERIC_CTA_PATTERNS = [
  /worth comparing notes/i,
  /circle back/i,
  /keep this on your radar/i,
  /let me know if/i,
  /touching base/i,
  /checking in/i,
  /thoughts\?$/i,
  /hope you're well/i,
]

const ACTION_PATTERNS = [
  /\b(review|call|walkthrough|assessment|audit|diagnostic|meeting|schedule|compare|benchmark|minute)\b/i,
  /\?\s*$/,
]

function extractClosingSentence(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ""
  const sentences = trimmed.split(/(?<=[.!?])\s+/)
  return sentences[sentences.length - 1]?.trim() ?? trimmed
}

export function evaluateApolloCtaQuality(input: {
  body: string
  explicitCta?: string | null
  evidence?: string | null
  companyName?: string
}): ApolloCtaQualityResult {
  const ctaText = (input.explicitCta?.trim() || extractClosingSentence(input.body)).trim()
  const issues: string[] = []

  const is_missing = !ctaText
  const is_generic = GENERIC_CTA_PATTERNS.some((pattern) => pattern.test(ctaText))
  const is_weak = is_missing || is_generic || isWeakGenericCta(ctaText)

  if (is_missing) issues.push("missing_cta")
  if (is_generic) issues.push("generic_cta")
  if (is_weak && !is_missing && !is_generic) issues.push("weak_cta")

  let specificity = 40
  if (input.evidence && ctaText.toLowerCase().includes(input.evidence.toLowerCase().slice(0, 12))) {
    specificity += 35
  }
  if (/\b(dispatch|scheduling|workflow|service|ops|field)\b/i.test(ctaText)) specificity += 20
  if (input.companyName && ctaText.includes(input.companyName)) specificity += 10
  specificity = Math.min(100, specificity)

  const actionability = ACTION_PATTERNS.some((pattern) => pattern.test(ctaText)) ? 90 : 25
  const relevance = input.evidence ? 85 : 55
  const meeting_likelihood =
    /\b(15-minute|walkthrough|calendar|schedule|call)\b/i.test(ctaText) ? 80 : is_weak ? 20 : 55

  const score = Math.round(
    specificity * 0.3 + actionability * 0.3 + relevance * 0.2 + meeting_likelihood * 0.2,
  )

  return {
    score,
    specificity,
    actionability,
    relevance,
    meeting_likelihood,
    is_weak,
    is_generic,
    is_missing,
    issues,
  }
}
