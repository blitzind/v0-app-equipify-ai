/** GS-AI-PLAYBOOK-4C — Narrative theme progression (client-safe). */

import type {
  GrowthSequenceNarrativeProgression,
  GrowthSequenceNarrativeTheme,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildSequenceHistoryHaystack } from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"

const ALL_THEMES: GrowthSequenceNarrativeTheme[] = [
  "industry_pain",
  "compliance_pain",
  "workflow_pain",
  "growth_pain",
  "financial_pain",
  "case_study",
  "comparison",
  "roi_proof",
  "social_proof",
]

const THEME_PATTERNS: Record<GrowthSequenceNarrativeTheme, RegExp> = {
  industry_pain: /\bindustry|sector|space often|teams in this|field service pattern/i,
  compliance_pain: /\bcompliance|audit|regulatory|hipaa|osha|inspection|documentation/i,
  workflow_pain: /\bworkflow|dispatch|scheduling|work order|pm schedule|maintenance plan|routing/i,
  growth_pain: /\bgrowth|scale|expansion|hiring|headcount|capacity|backlog/i,
  financial_pain: /\broi|cost|margin|profit|budget|spend|financial|efficiency savings/i,
  case_study: /\bcase study|customer story|client example|similar team|peer/i,
  comparison: /\bcompare|versus|vs\.|alternative|evaluation|benchmark/i,
  roi_proof: /\broi|payback|savings|return on|cost reduction|labor savings/i,
  social_proof: /\btrusted by|used by|reference|testimonial|proof point|results/i,
}

const TOUCH_THEME_PROGRESSION: GrowthSequenceNarrativeTheme[] = [
  "industry_pain",
  "workflow_pain",
  "compliance_pain",
  "case_study",
  "roi_proof",
  "social_proof",
  "comparison",
  "growth_pain",
  "financial_pain",
]

function detectThemes(haystack: string): GrowthSequenceNarrativeTheme[] {
  return ALL_THEMES.filter((theme) => THEME_PATTERNS[theme].test(haystack))
}

function countThemeOccurrences(haystack: string, theme: GrowthSequenceNarrativeTheme): number {
  const matches = haystack.match(THEME_PATTERNS[theme])
  return matches?.length ?? 0
}

export function buildGrowthSequenceNarrativeProgression(
  input: GrowthSequenceSignalInput,
): GrowthSequenceNarrativeProgression {
  const haystack = buildSequenceHistoryHaystack(input)
  const usedThemes = detectThemes(haystack)
  const unusedThemes = ALL_THEMES.filter((theme) => !usedThemes.includes(theme))
  const overusedThemes = usedThemes.filter((theme) => countThemeOccurrences(haystack, theme) >= 2)

  const touchIndex = Math.max(input.priorTouchCount ?? 0, input.sequenceHistorySummaries?.length ?? 0)
  const progressionCandidates = TOUCH_THEME_PROGRESSION.filter((theme) => !overusedThemes.includes(theme))
  const recommendedThemes = [
    progressionCandidates[touchIndex] ?? progressionCandidates[0] ?? "workflow_pain",
    ...unusedThemes.filter((theme) => !progressionCandidates.includes(theme)),
  ]
    .filter((theme, idx, arr) => arr.indexOf(theme) === idx)
    .slice(0, 3)

  return {
    usedThemes,
    unusedThemes,
    overusedThemes,
    recommendedThemes,
  }
}

export function narrativeThemeLabel(theme: GrowthSequenceNarrativeTheme): string {
  return theme.replace(/_/g, " ")
}
