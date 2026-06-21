/** GS-AI-PLAYBOOK-3B — Quality dimension evaluator (client-safe). */

import {
  detectPersonalizationQualityIssues,
  GROWTH_PERSONALIZATION_AI_PHRASES,
  GROWTH_PERSONALIZATION_HYPE_WORDS,
  GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-rules"
import type {
  GrowthPersonalizationQualityChannel,
  GrowthPersonalizationQualityDimensionScores,
  GrowthPersonalizationQualityIssueType,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-types"

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function averageSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).map((entry) => entry.trim()).filter(Boolean)
  if (sentences.length === 0) return text.length
  return sentences.reduce((sum, sentence) => sum + countWords(sentence), 0) / sentences.length
}

function evidenceHits(text: string, allowedFacts: string[]): number {
  const lower = text.toLowerCase()
  return allowedFacts.filter((fact) => {
    const snippet = fact
      .replace(/^(Summary|Website|Service focus|Observed|Hiring signal|Site excerpt|Enrichment):\s*/i, "")
      .trim()
      .toLowerCase()
      .slice(0, 40)
    return snippet.length >= 12 && lower.includes(snippet.slice(0, 20))
  }).length
}

export function evaluatePersonalizationQualityDimensions(input: {
  channel: GrowthPersonalizationQualityChannel
  subject?: string | null
  body: string
  companyName?: string | null
  contactName?: string | null
  allowedFacts?: string[]
  maxWords?: number
  maxChars?: number
}): {
  dimensionScores: GrowthPersonalizationQualityDimensionScores
  issuesDetected: GrowthPersonalizationQualityIssueType[]
} {
  const text = [input.subject, input.body].filter(Boolean).join(" ")
  const lower = text.toLowerCase()
  const allowedFacts = input.allowedFacts ?? []
  const issuesDetected = detectPersonalizationQualityIssues(text, allowedFacts)
  const company = input.companyName?.trim()
  const contact = input.contactName?.trim()
  const words = countWords(input.body)

  const hasCompany = company ? lower.includes(company.toLowerCase()) : false
  const hasContact = contact ? lower.includes(contact.split(/\s+/)[0]!.toLowerCase()) : false
  const questionCount = (input.body.match(/\?/g) ?? []).length
  const aiPhraseCount = GROWTH_PERSONALIZATION_AI_PHRASES.filter((phrase) => lower.includes(phrase)).length
  const hypeCount = GROWTH_PERSONALIZATION_HYPE_WORDS.filter((word) => lower.includes(word)).length
  const weakCta = GROWTH_PERSONALIZATION_WEAK_CTA_PATTERNS.some((pattern) => pattern.test(input.body))
  const evidenceCount = evidenceHits(input.body, allowedFacts)
  const avgSentence = averageSentenceLength(input.body)

  const maxWords = input.maxWords ?? (input.channel === "SMS" ? 55 : 140)
  const maxChars = input.maxChars ?? (input.channel === "SMS" ? 320 : 2000)

  const dimensionScores: GrowthPersonalizationQualityDimensionScores = {
    specificity: clampScore(45 + (hasCompany ? 25 : 0) + (hasContact ? 15 : 0) + evidenceCount * 8),
    consultativeTone: clampScore(70 + questionCount * 8 - hypeCount * 12 - (issuesDetected.includes("too_salesy") ? 20 : 0)),
    credibility: clampScore(75 - (issuesDetected.includes("unsupported_claim") ? 30 : 0) - hypeCount * 10),
    personalization: clampScore(40 + (hasContact ? 30 : 0) + (hasCompany ? 20 : 0) + evidenceCount * 10),
    clarity: clampScore(88 - Math.max(0, avgSentence - 22) * 2),
    conciseness: clampScore(
      input.channel === "SMS"
        ? 100 - Math.max(0, input.body.length - maxChars * 0.85) / 4
        : 100 - Math.max(0, words - maxWords) * 1.5,
    ),
    flow: clampScore(80 - (issuesDetected.includes("poor_sequence") ? 25 : 0) - (issuesDetected.includes("repetitive_language") ? 15 : 0)),
    ctaQuality: clampScore(weakCta || issuesDetected.includes("weak_cta") ? 52 : 86),
    humanTone: clampScore(90 - aiPhraseCount * 14 - (issuesDetected.includes("ai_sounding_phrases") ? 18 : 0)),
    evidenceUsage: clampScore(allowedFacts.length === 0 ? 60 : 35 + evidenceCount * 18),
  }

  for (const issue of issuesDetected) {
    if (issue === "generic_opening") dimensionScores.personalization = Math.min(dimensionScores.personalization, 55)
    if (issue === "feature_dump") dimensionScores.consultativeTone = Math.min(dimensionScores.consultativeTone, 58)
    if (issue === "generic_pain") dimensionScores.specificity = Math.min(dimensionScores.specificity, 50)
  }

  return { dimensionScores, issuesDetected }
}

export function computeOverallQualityScore(scores: GrowthPersonalizationQualityDimensionScores): number {
  const values = Object.values(scores)
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length)
}
