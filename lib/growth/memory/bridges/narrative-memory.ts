/** GE-AIOS-12A — Memory → Narrative bridge (experience-rich copy). */

import type { AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { buildTimelineNarrativeLine } from "@/lib/growth/memory/timeline/organization-memory-timeline"

export function buildMemoryNarrativeLines(memorySummary: AvaMemorySummary | null | undefined): string[] {
  if (!memorySummary) return []

  const lines: string[] = []
  if (memorySummary.period_summary) {
    lines.push(memorySummary.period_summary)
  }

  const timelineLine = buildTimelineNarrativeLine(memorySummary.timeline)
  if (timelineLine && !lines.includes(timelineLine)) {
    lines.push(timelineLine)
  }

  const topPattern = memorySummary.detected_patterns[0]
  if (topPattern && !lines.some((line) => line.includes(topPattern.label.slice(0, 24)))) {
    lines.push(
      `Over time I've learned that ${topPattern.label.charAt(0).toLowerCase()}${topPattern.label.slice(1)}`,
    )
  }

  return lines.slice(0, 3)
}

export function buildMemoryStoryBlocks(memorySummary: AvaMemorySummary | null | undefined): AvaStoryBlock[] {
  return buildMemoryNarrativeLines(memorySummary).map((text, index) => ({
    id: `memory-narrative:${index}`,
    kind: "general",
    priority: 90 - index,
    text: text.endsWith(".") ? text : `${text}.`,
    href: null,
  }))
}

export function buildWhatIveLearnedBullets(memorySummary: AvaMemorySummary | null | undefined): string[] {
  if (!memorySummary) return []
  return memorySummary.learned_insights.slice(0, 3)
}

export const AVA_MEMORY_WHAT_IVE_LEARNED_TITLE = "What I've Learned" as const
