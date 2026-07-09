/** GE-AIOS-12A — Deterministic period summaries from memory events. */

import type { AvaMemoryEvent, AvaMemoryTimelinePeriod } from "@/lib/growth/memory/types"

export function summarizeMemoryPeriod(input: {
  events: AvaMemoryEvent[]
  timeline: AvaMemoryTimelinePeriod[]
  generatedAt: string
}): string | null {
  const { events, timeline } = input
  if (events.length === 0) return null

  const qualified = events.filter((row) => /qualif/i.test(row.summary)).length
  const meetings = events.filter((row) => row.category === "meeting").length
  const approvals = events.filter((row) => row.category === "approval").length
  const researched = events.filter((row) => /research/i.test(row.summary)).length

  const lastWeek = timeline.find((row) => row.label === "Last week" || row.label === "This week")
  if (lastWeek && qualified >= 2 && meetings >= 1) {
    return `Over the past week I've identified ${qualified} qualified companies and booked ${meetings} ${meetings === 1 ? "meeting" : "meetings"}.`
  }

  if (researched >= 5 && qualified >= 1) {
    return `Over the past month I've researched ${researched} companies and qualified ${qualified}.`
  }

  if (approvals >= 2) {
    return `Recently ${approvals} outreach ${approvals === 1 ? "draft was" : "drafts were"} approved.`
  }

  const wins = events.filter((row) => row.category === "win").length
  if (wins >= 2) {
    return `Recently ${wins} companies moved closer to outreach readiness.`
  }

  return null
}

export function buildLearnedInsights(input: {
  patterns: Array<{ label: string }>
  preferences: Array<{ statement: string }>
  events: AvaMemoryEvent[]
  corrections: Array<{ summary: string }>
}): string[] {
  const insights: string[] = []

  for (const pattern of input.patterns.slice(0, 2)) {
    insights.push(pattern.label)
  }

  for (const preference of input.preferences.slice(0, 2)) {
    if (!insights.includes(preference.statement)) {
      insights.push(preference.statement)
    }
  }

  if (insights.length < 3) {
    const risk = input.events.find((row) => row.category === "risk")
    if (risk && !insights.includes(risk.summary)) {
      insights.push(risk.summary.replace(/\.$/, "") + ".")
    }
  }

  if (insights.length < 3 && input.corrections[0]) {
    insights.push(input.corrections[0].summary)
  }

  return insights.slice(0, 3)
}
