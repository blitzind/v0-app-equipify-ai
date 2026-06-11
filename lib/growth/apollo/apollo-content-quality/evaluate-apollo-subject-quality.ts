/** Subject line quality evaluation for Apollo outreach (Phase 11D). */

import {
  isGenericSubjectPattern,
  scoreSubjectQuality,
} from "@/lib/growth/outreach/personalization/subject-intelligence"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"

import type { ApolloSubjectQualityResult } from "@/lib/growth/apollo/apollo-content-quality/apollo-content-quality-types"

export function evaluateApolloSubjectQuality(input: {
  subject: string
  companyName: string
  generationType?: GrowthAiCopilotGenerationType
  evidence?: string | null
  priorSubjects?: string[]
  category?: string
}): ApolloSubjectQualityResult {
  const subject = input.subject.trim()
  const issues: string[] = []
  const is_generic = isGenericSubjectPattern(subject)
  const is_fallback = /quick ops note|quick note for/i.test(subject)

  if (is_generic) issues.push("generic_subject")
  if (is_fallback) issues.push("fallback_subject")

  const priorSubjects = input.priorSubjects ?? []
  const normalized = subject.toLowerCase().replace(/[^\w\s]/g, " ").trim()
  const is_duplicate_risk = priorSubjects.some((prior) => {
    const priorNorm = prior.toLowerCase().replace(/[^\w\s]/g, " ").trim()
    return priorNorm === normalized || priorNorm.includes(normalized) || normalized.includes(priorNorm)
  })
  if (is_duplicate_risk) issues.push("duplicate_subject_risk")

  const scored = scoreSubjectQuality({
    subject,
    category: (input.category as "curiosity") ?? "curiosity",
    evidence: input.evidence ?? null,
    generationType: input.generationType ?? "cold_email",
    priorSubjects,
    companyName: input.companyName,
  })

  const personalization =
    subject.toLowerCase().includes(input.companyName.toLowerCase()) || input.evidence
      ? Math.min(100, scored.specificity + 10)
      : scored.specificity

  return {
    score: scored.overall,
    personalization,
    relevance: scored.relevance,
    specificity: scored.specificity,
    curiosity: scored.curiosity,
    is_generic,
    is_fallback,
    is_duplicate_risk,
    issues,
  }
}
