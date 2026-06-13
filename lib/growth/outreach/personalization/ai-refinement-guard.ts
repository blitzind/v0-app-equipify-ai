/** AI refinement guardrails for outreach personalization (slice 6.15B). */

import { countWords } from "@/lib/growth/outreach/personalization/message-variability"

export const OUTREACH_SPAM_PHRASES = [
  "act now",
  "limited time",
  "guaranteed",
  "100%",
  "best in class",
  "revolutionary",
  "game changer",
  "don't miss out",
  "once in a lifetime",
  "click here",
  "free money",
  "risk-free",
] as const

export const OUTREACH_HYPE_PHRASES = [
  "congrats on",
  "i noticed your amazing",
  "i loved your website",
  "impressive growth",
  "incredible team",
  "world-class",
  "cutting-edge innovation",
] as const

export const OUTREACH_FAKE_URGENCY_PHRASES = [
  "urgent",
  "asap",
  "today only",
  "before it's too late",
  "last chance",
  "immediate action required",
] as const

export type OutreachRefinementGuardResult = {
  ok: boolean
  reasons: string[]
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

function includesBannedPhrase(text: string, phrases: readonly string[]): string | null {
  const normalized = normalize(text)
  for (const phrase of phrases) {
    if (normalized.includes(phrase)) return phrase
  }
  return null
}

export function collectAllowedFacts(facts: string[]): string[] {
  return facts
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 40)
}

export function validateOutreachRefinement(input: {
  refinedBody: string
  refinedSubject: string | null
  deterministicBody: string
  allowedFacts: string[]
  maxWords: number
}): OutreachRefinementGuardResult {
  const reasons: string[] = []
  const combined = `${input.refinedSubject ?? ""} ${input.refinedBody}`

  const spam = includesBannedPhrase(combined, OUTREACH_SPAM_PHRASES)
  if (spam) reasons.push(`spam_phrase:${spam}`)

  const hype = includesBannedPhrase(combined, OUTREACH_HYPE_PHRASES)
  if (hype) reasons.push(`hype_phrase:${hype}`)

  const urgency = includesBannedPhrase(combined, OUTREACH_FAKE_URGENCY_PHRASES)
  if (urgency) reasons.push(`fake_urgency:${urgency}`)

  if (countWords(input.refinedBody) > input.maxWords) {
    reasons.push("max_words_exceeded")
  }

  if (/\*{2,}/.test(input.refinedBody) || /\*{2,}/.test(input.refinedSubject ?? "")) {
    reasons.push("redacted_contact_or_content")
  }

  if (/\S+…\s/.test(input.refinedBody)) {
    reasons.push("mid_body_truncation")
  }

  if (/!{2,}/.test(input.refinedBody) || /!{2,}/.test(input.refinedSubject ?? "")) {
    reasons.push("excessive_punctuation")
  }

  const urlPattern = /https?:\/\/[^\s]+/gi
  const allowedHaystack = normalize([...input.allowedFacts, input.deterministicBody].join(" "))
  for (const match of input.refinedBody.match(urlPattern) ?? []) {
    if (!allowedHaystack.includes(normalize(match))) {
      reasons.push("invented_url")
      break
    }
  }

  const researchClaimPattern =
    /\b(i saw|i noticed|i reviewed|your website shows|your site mentions|according to your website)\b/i
  if (researchClaimPattern.test(input.refinedBody) && !allowedHaystack.includes("website")) {
    reasons.push("invented_website_claim")
  }

  return { ok: reasons.length === 0, reasons }
}

export function sanitizeRefinedBody(body: string): string {
  return body.replace(/\s+/g, " ").trim()
}
