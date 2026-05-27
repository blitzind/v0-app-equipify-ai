/** Press/news expansion signal provider abstraction — stub only. */

import type {
  RawEvidenceSourceCandidate,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"

export type PressProviderInput = {
  company_name: string
  description?: string | null
  metadata?: Record<string, unknown>
}

export type PressProviderResult = {
  provider: "stub" | "manual"
  evidence: RawEvidenceSourceCandidate[]
  signals: RawGrowthSignalCandidate[]
}

const EXPANSION_PATTERNS = [
  { signal_type: "expansion" as const, pattern: /\bexpand(?:ing|s|ed)?\b|\bgrowth\b|\bnew branch\b/i },
  { signal_type: "funding_or_acquisition" as const, pattern: /\bacquisition\b|\bacquired\b|\bfunding\b|\bseries [a-d]\b/i },
  { signal_type: "service_line_expansion" as const, pattern: /\bnew service\b|\badded service\b|\bservice line\b/i },
  { signal_type: "equipment_specialty_detected" as const, pattern: /\bbiomedical\b|\bhvac\b|\bmedical equipment\b|\bfield service\b/i },
]

export function fetchPressExpansionSignalsStub(input: PressProviderInput): PressProviderResult {
  const blob = `${input.company_name} ${input.description ?? ""}`.trim()
  const evidence: RawEvidenceSourceCandidate[] = []
  const signals: RawGrowthSignalCandidate[] = []

  for (const rule of EXPANSION_PATTERNS) {
    const match = blob.match(rule.pattern)
    if (!match) continue
    const excerpt = blob.slice(Math.max(0, (match.index ?? 0) - 20), (match.index ?? 0) + 120)
    evidence.push({
      source_type: "press_news",
      source_url: null,
      confidence_score: 55,
      evidence_excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 240),
      metadata: { provider: "stub" },
    })
    signals.push({
      signal_type: rule.signal_type,
      confidence_score: 55,
      source_type: "press_news",
      source_url: null,
      evidence_excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 240),
      metadata: { provider: "stub" },
    })
  }

  return { provider: "stub", evidence, signals }
}
