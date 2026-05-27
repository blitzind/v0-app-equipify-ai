/** Deterministic decision maker title scoring (Apollo replacement layer). Client-safe. */

import type { DecisionMakerScoreResult } from "@/lib/growth/contact-discovery/company-contact-types"

type TitleRule = {
  pattern: RegExp
  score: number
  label: string
}

const TITLE_RULES: TitleRule[] = [
  { pattern: /\b(ceo|chief executive officer)\b/i, score: 100, label: "CEO" },
  { pattern: /\b(owner|co-owner|founder|co-founder|president)\b/i, score: 100, label: "Owner/President" },
  { pattern: /\bvp\b.*\boperations\b|\bvice president\b.*\boperations\b/i, score: 90, label: "VP Operations" },
  { pattern: /\boperations director\b|\bdirector of operations\b/i, score: 85, label: "Operations Director" },
  { pattern: /\bfield service director\b|\bdirector of field service\b/i, score: 85, label: "Field Service Director" },
  { pattern: /\bservice manager\b|\bdirector of service\b/i, score: 80, label: "Service Manager" },
  { pattern: /\bgeneral manager\b|\bgm\b/i, score: 75, label: "General Manager" },
  {
    pattern: /\bbiomedical engineering director\b|\bdirector of biomedical engineering\b/i,
    score: 95,
    label: "Biomedical Engineering Director",
  },
  {
    pattern: /\bdirector clinical engineering\b|\bclinical engineering director\b/i,
    score: 95,
    label: "Director Clinical Engineering",
  },
  { pattern: /\bdispatcher\b|\bdispatch manager\b/i, score: 35, label: "Dispatcher" },
  { pattern: /\boffice manager\b|\badministrative assistant\b/i, score: 40, label: "Office Manager" },
]

const LEADERSHIP_KEYWORDS = /\b(chief|president|owner|founder|executive|director|vp|vice president|head of)\b/i
const OPERATIONS_KEYWORDS = /\b(operations|service|field|dispatch|maintenance|clinical|biomedical)\b/i

function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/\s+/g, " ").trim()
}

function matchTitleRule(title: string): TitleRule | null {
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(title)) return rule
  }
  return null
}

export function scoreDecisionMakerTitle(input: {
  title: string | null | undefined
  source_type?: string | null
  evidence_count?: number
  has_website_evidence?: boolean
  exact_title_match?: boolean
}): DecisionMakerScoreResult {
  const title = normalizeTitle(input.title)
  const reasoning: string[] = []
  let baseScore = 0

  const rule = title ? matchTitleRule(title) : null
  if (rule) {
    baseScore = rule.score
    reasoning.push(`Title match: ${rule.label} (${rule.score})`)
  } else if (title) {
    baseScore = 25
    reasoning.push("Title present without known decision-maker pattern")
  } else {
    baseScore = 0
    reasoning.push("No title provided")
  }

  let confidence = baseScore

  if (input.exact_title_match && rule) {
    confidence += 25
    reasoning.push("Exact title match (+25)")
  }

  if (title && LEADERSHIP_KEYWORDS.test(title)) {
    confidence += 15
    reasoning.push("Leadership keyword (+15)")
  }

  if (title && OPERATIONS_KEYWORDS.test(title)) {
    confidence += 10
    reasoning.push("Operations keyword (+10)")
  }

  if (input.has_website_evidence) {
    confidence += 10
    reasoning.push("Website evidence (+10)")
  }

  const evidenceCount = input.evidence_count ?? 0
  if (evidenceCount >= 2) {
    confidence += 15
    reasoning.push("Multiple evidence sources (+15)")
  } else if (evidenceCount === 1) {
    confidence += 5
    reasoning.push("Single evidence source (+5)")
  }

  if (input.source_type === "team_page" || input.source_type === "leadership_page") {
    confidence += 5
    reasoning.push("Team/leadership page source (+5)")
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)))
  const decision_maker_score = Math.max(0, Math.min(100, baseScore))

  return {
    decision_maker_score,
    confidence_score: confidence,
    confidence_reasoning: reasoning,
  }
}

export function rankCompanyContactsByDecisionMaker<T extends { decision_maker_score: number; confidence_score: number }>(
  contacts: T[],
): T[] {
  return [...contacts].sort((a, b) => {
    const diff = b.decision_maker_score - a.decision_maker_score
    if (diff !== 0) return diff
    return b.confidence_score - a.confidence_score
  })
}
