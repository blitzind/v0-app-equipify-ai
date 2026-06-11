/** Draft regeneration reason analytics (Phase 13D). */

import {
  APOLLO_DRAFT_REGENERATION_CATEGORIES,
  type ApolloDraftRegenerationBreakdown,
  type ApolloDraftRegenerationCategory,
  type ApolloOperatorQueueItem,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

const CATEGORY_LABELS: Record<ApolloDraftRegenerationCategory, string> = {
  personalization_weak: "Personalization weak",
  cta_weak: "CTA weak",
  wrong_tone: "Wrong tone",
  inaccurate_research: "Inaccurate research",
  subject_issue: "Subject issue",
  operator_custom: "Operator custom reason",
  unknown: "Unknown",
}

const CATEGORY_PATTERNS: Array<{ category: ApolloDraftRegenerationCategory; patterns: RegExp[] }> = [
  { category: "personalization_weak", patterns: [/personalization/i, /generic/i, /placeholder/i, /weak content/i] },
  { category: "cta_weak", patterns: [/cta/i, /call to action/i, /closing/i] },
  { category: "wrong_tone", patterns: [/tone/i, /too formal/i, /too casual/i, /voice/i] },
  { category: "inaccurate_research", patterns: [/research/i, /inaccurate/i, /wrong fact/i, /evidence/i] },
  { category: "subject_issue", patterns: [/subject/i, /subject line/i] },
]

export function classifyApolloDraftRegenerationReason(note: string | null): ApolloDraftRegenerationCategory {
  const text = (note ?? "").trim()
  if (!text) return "unknown"
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.category
  }
  return "operator_custom"
}

export function buildApolloDraftRegenerationAnalytics(
  items: ApolloOperatorQueueItem[],
): ApolloDraftRegenerationBreakdown[] {
  const regenerated = items.filter((item) => item.outcome === "regenerated")
  const counts = new Map<ApolloDraftRegenerationCategory, number>()

  for (const category of APOLLO_DRAFT_REGENERATION_CATEGORIES) {
    counts.set(category, 0)
  }

  for (const item of regenerated) {
    const category = classifyApolloDraftRegenerationReason(item.regeneration_note)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  const total = regenerated.length
  return APOLLO_DRAFT_REGENERATION_CATEGORIES.map((category) => {
    const count = counts.get(category) ?? 0
    return {
      category,
      label: CATEGORY_LABELS[category],
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }
  }).filter((row) => row.count > 0 || row.category === "unknown")
}
