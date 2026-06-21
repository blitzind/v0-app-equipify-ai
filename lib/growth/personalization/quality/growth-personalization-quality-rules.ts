/** GS-AI-PLAYBOOK-3B — Quality detection rules (client-safe). */

import type { GrowthPersonalizationQualityIssueType } from "@/lib/growth/personalization/quality/growth-personalization-quality-types"

export const GROWTH_PERSONALIZATION_AI_PHRASES = [
  "i hope this email finds you well",
  "i hope this message finds you well",
  "i wanted to reach out",
  "just circling back",
  "touch base",
  "circle back",
  "leverage",
  "synergy",
  "game-changer",
  "best-in-class",
  "cutting-edge",
  "delighted to",
  "excited to introduce",
  "at your earliest convenience",
  "please do not hesitate",
] as const

export const GROWTH_PERSONALIZATION_HYPE_WORDS = [
  "revolutionary",
  "unparalleled",
  "world-class",
  "disrupt",
  "crush",
  "guaranteed",
  "ultimate",
  "must-have",
] as const

export const GROWTH_PERSONALIZATION_GENERIC_OPENING_PATTERNS = [
  /^hi there regarding\b[^.?!]*/i,
  /^hello there regarding\b[^.?!]*/i,
  /^hi there\b/i,
  /^hello there\b/i,
  /^hi,\s*there\b/i,
  /^hi regarding\b/i,
  /^hello regarding\b/i,
  /^hi,\s*regarding\b/i,
  /^dear sir\b/i,
  /^dear madam\b/i,
] as const

export const GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS = [
  /\bequipify can help with\b/i,
  /\bour platform (can|helps|offers)\b/i,
  /\bwe offer a (suite|platform|solution)\b/i,
  /\bwork orders and scheduling\b/i,
  /\bscheduling and dispatch\b/i,
] as const

export const GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS = [
  /\bwould you like a demo\b/i,
  /\bschedule a demo\b/i,
  /\bbook a demo\b/i,
  /\blet me know if you(?:'re| are) interested\b/i,
  /\bhappy to chat\b/i,
  /\bopen to a call\b/i,
] as const

export const GROWTH_PERSONALIZATION_GENERIC_PAIN_PATTERNS = [
  /\bstruggle with operational inefficienc/i,
  /\bmany companies like yours\b/i,
  /\bin today's competitive landscape\b/i,
  /\bcompanies often face challenges\b/i,
] as const

const ISSUE_RULES: Array<{
  issue: GrowthPersonalizationQualityIssueType
  test: (text: string) => boolean
}> = [
  {
    issue: "generic_opening",
    test: (text) => GROWTH_PERSONALIZATION_GENERIC_OPENING_PATTERNS.some((pattern) => pattern.test(text)),
  },
  {
    issue: "generic_pain",
    test: (text) => GROWTH_PERSONALIZATION_GENERIC_PAIN_PATTERNS.some((pattern) => pattern.test(text)),
  },
  {
    issue: "too_salesy",
    test: (text) =>
      GROWTH_PERSONALIZATION_HYPE_WORDS.some((word) => text.toLowerCase().includes(word)) ||
      (text.match(/!/g)?.length ?? 0) >= 2,
  },
  {
    issue: "feature_dump",
    test: (text) => GROWTH_PERSONALIZATION_FEATURE_DUMP_PATTERNS.some((pattern) => pattern.test(text)),
  },
  {
    issue: "weak_cta",
    test: (text) => GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS.some((pattern) => pattern.test(text)),
  },
  {
    issue: "ai_sounding_phrases",
    test: (text) => GROWTH_PERSONALIZATION_AI_PHRASES.some((phrase) => text.toLowerCase().includes(phrase)),
  },
  {
    issue: "repetitive_language",
    test: (text) => {
      const sentences = text.split(/[.!?]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      return new Set(sentences).size < sentences.length
    },
  },
  {
    issue: "paragraph_length",
    test: (text) => text.split(/\n\n+/).some((paragraph) => paragraph.split(/\s+/).length > 90),
  },
  {
    issue: "poor_sequence",
    test: (text) => {
      const lower = text.toLowerCase()
      const ctaIndex = Math.max(lower.lastIndexOf("?"), lower.lastIndexOf("demo"), lower.lastIndexOf("walkthrough"))
      const openIndex = lower.indexOf("equipify")
      return openIndex >= 0 && ctaIndex >= 0 && openIndex < 40 && ctaIndex > openIndex && ctaIndex < lower.length * 0.5
    },
  },
]

export function detectPersonalizationQualityIssues(
  text: string,
  allowedFacts: string[] = [],
): GrowthPersonalizationQualityIssueType[] {
  const issues = ISSUE_RULES.filter((rule) => rule.test(text)).map((rule) => rule.issue)
  if (detectUnsupportedClaims(text, allowedFacts)) {
    issues.push("unsupported_claim")
  }
  return [...new Set(issues)]
}

function detectUnsupportedClaims(text: string, allowedFacts: string[]): boolean {
  if (allowedFacts.length === 0) return false
  const claimPatterns = [
    /\byou (?:are|were|have) (?:struggling|facing|dealing with)\b/i,
    /\byour team (?:is|was) (?:behind|overwhelmed|understaffed)\b/i,
    /\brecently (?:raised|acquired|expanded|hired)\b/i,
  ]
  const corpus = allowedFacts.join(" ").toLowerCase()
  return claimPatterns.some((pattern) => pattern.test(text) && !pattern.test(corpus))
}

export function firstNameFromContact(contactName?: string | null): string | null {
  if (!contactName?.trim()) return null
  return contactName.trim().split(/\s+/)[0] ?? null
}

export function pickVerifiedObservation(allowedFacts: string[], companyName?: string | null): string | null {
  for (const fact of allowedFacts) {
    const cleaned = fact
      .replace(/^(Summary|Website|Service focus|Observed|Hiring signal|Contact role|Site excerpt|Enrichment):\s*/i, "")
      .trim()
    if (cleaned.length < 12) continue
    if (companyName && cleaned.toLowerCase().includes(companyName.toLowerCase())) {
      return cleaned
    }
    if (/^(provides|supports|offers|delivers|operates|specializes)/i.test(cleaned)) {
      return cleaned
    }
  }
  return allowedFacts[0]?.replace(/^(Summary|Website|Service focus|Observed):\s*/i, "").trim() ?? null
}
