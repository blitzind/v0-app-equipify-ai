/** GE-AIOS-12A — Chronological organizational memory timeline. */

import type { AvaMemoryEvent, AvaMemoryTimelinePeriod } from "@/lib/growth/memory/types"

const DAY_MS = 86_400_000

function periodLabelForTimestamp(timestamp: string, now: string): string {
  const eventTime = new Date(timestamp).getTime()
  const nowTime = new Date(now).getTime()
  const diffDays = Math.floor((nowTime - eventTime) / DAY_MS)

  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays <= 7) return "This week"
  if (diffDays <= 14) return "Last week"
  if (diffDays <= 30) return "This month"
  return "Earlier"
}

export function buildOrganizationMemoryTimeline(input: {
  events: AvaMemoryEvent[]
  generatedAt: string
}): AvaMemoryTimelinePeriod[] {
  const sorted = [...input.events].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  )

  const groups = new Map<string, AvaMemoryEvent[]>()
  for (const event of sorted) {
    const label = periodLabelForTimestamp(event.timestamp, input.generatedAt)
    groups.set(label, [...(groups.get(label) ?? []), event])
  }

  const order = ["Today", "Yesterday", "This week", "Last week", "This month", "Earlier"]
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({
      id: slug(label),
      label,
      events: (groups.get(label) ?? []).slice(0, 12),
    }))
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

export function buildTimelineNarrativeLine(timeline: AvaMemoryTimelinePeriod[]): string | null {
  const today = timeline.find((row) => row.label === "Today")
  const lastWeek = timeline.find((row) => row.label === "Last week" || row.label === "This week")
  if (!today && !lastWeek) return null

  const qualified = countEventsByKeyword(timeline, /qualif/i)
  const meetings = countEventsByCategory(timeline, "meeting")
  const researched = countEventsByKeyword(timeline, /research/i)

  if (qualified >= 2 && meetings >= 1) {
    return `Since last week, we've identified ${qualified} qualified companies and booked ${meetings} ${meetings === 1 ? "meeting" : "meetings"}.`
  }
  if (researched >= 3) {
    return `Since last week, we've researched ${researched} companies and continued building pipeline momentum.`
  }
  if (today && today.events.length >= 2) {
    return `Today: ${today.events
      .slice(0, 3)
      .map((row) => row.summary.replace(/\.$/, ""))
      .join(". ")}.`
  }

  return null
}

function countEventsByKeyword(timeline: AvaMemoryTimelinePeriod[], pattern: RegExp): number {
  return timeline.reduce(
    (total, period) => total + period.events.filter((event) => pattern.test(event.summary)).length,
    0,
  )
}

function countEventsByCategory(timeline: AvaMemoryTimelinePeriod[], category: AvaMemoryEvent["category"]): number {
  return timeline.reduce(
    (total, period) => total + period.events.filter((event) => event.category === category).length,
    0,
  )
}
