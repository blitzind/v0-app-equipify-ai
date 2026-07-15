/** GE-AIOS-12A / GE-AIOS-17A / GE-AIOS-17C — Memory → Narrative bridge (experience-rich copy). */

import type { AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { buildValidatedInstitutionalLearningBullets } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import { buildTimelineNarrativeLine } from "@/lib/growth/memory/timeline/organization-memory-timeline"
import { buildCompletedWorkNarrativeLines } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"

export function buildMemoryNarrativeLines(
  memorySummary: AvaMemorySummary | null | undefined,
  salesDailySummary?: SalesOutcomeDailySummary | null,
): string[] {
  if (!memorySummary) return []

  const completedWorkLines = buildCompletedWorkNarrativeLines({
    dailySummary: salesDailySummary ?? null,
    memoryEvents: memorySummary.recent_events,
  })

  const learningLines = buildValidatedInstitutionalLearningBullets(
    memorySummary.organizational_knowledge ?? [],
    2,
  ).map((finding) => {
    const text = finding.replace(/\.$/, "")
    return `I also learned that ${text.charAt(0).toLowerCase()}${text.slice(1)}.`
  })
  if (completedWorkLines.length > 0) {
    return [...completedWorkLines, ...learningLines].slice(0, 4)
  }

  if (learningLines.length > 0) return learningLines

  const lines: string[] = []
  if (memorySummary.period_summary) {
    lines.push(memorySummary.period_summary)
  }

  const timelineLine = buildTimelineNarrativeLine(memorySummary.timeline)
  if (timelineLine && !lines.includes(timelineLine)) {
    lines.push(timelineLine)
  }

  return lines.slice(0, 3)
}

export function buildMemoryStoryBlocks(
  memorySummary: AvaMemorySummary | null | undefined,
  salesDailySummary?: SalesOutcomeDailySummary | null,
): AvaStoryBlock[] {
  return buildMemoryNarrativeLines(memorySummary, salesDailySummary).map((text, index) => ({
    id: `memory-narrative:${index}`,
    kind: "general",
    priority: 90 - index,
    text: text.endsWith(".") ? text : `${text}.`,
    href: null,
  }))
}

export function buildWhatIveLearnedBullets(memorySummary: AvaMemorySummary | null | undefined): string[] {
  if (!memorySummary) return []
  return buildValidatedInstitutionalLearningBullets(memorySummary.organizational_knowledge ?? [], 3)
}

export const AVA_MEMORY_WHAT_IVE_LEARNED_TITLE = "What I've Learned" as const
