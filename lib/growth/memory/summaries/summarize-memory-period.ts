/** GE-AIOS-12A / GE-AIOS-17C — Deterministic period summaries from memory events. */

import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { buildValidatedInstitutionalLearningBullets } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"

import type { AvaMemoryEvent, AvaMemoryTimelinePeriod } from "@/lib/growth/memory/types"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { buildSalesCompletedWorkPeriodSummary } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"

export function summarizeMemoryPeriod(input: {
  events: AvaMemoryEvent[]
  timeline: AvaMemoryTimelinePeriod[]
  generatedAt: string
  salesDailySummary?: SalesOutcomeDailySummary | null
}): string | null {
  const completedWorkSummary = buildSalesCompletedWorkPeriodSummary(input.salesDailySummary)
  if (completedWorkSummary) return completedWorkSummary

  const salesEvents = input.events.filter((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE)
  if (salesEvents.length > 0) {
    const researched = salesEvents.filter((row) => row.metadata.outcome_type === "research_completed").length
    const qualified = salesEvents.filter((row) => row.metadata.outcome_type === "qualification_completed").length
    const approvals = salesEvents.filter(
      (row) => row.metadata.outcome_type === "approval_pending" || row.metadata.approval_required === true,
    ).length
    const parts: string[] = []
    if (researched > 0) parts.push(`Today I researched ${researched} companies.`)
    if (qualified > 0) parts.push(`I qualified ${qualified} opportunities.`)
    if (approvals > 0) {
      parts.push(
        `${approvals} outreach ${approvals === 1 ? "draft is" : "drafts are"} ready for your approval.`,
      )
    }
    if (parts.length > 0) return parts.join(" ")
  }

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
  organizationalKnowledge?: OrganizationalKnowledgeItem[]
}): string[] {
  return buildValidatedInstitutionalLearningBullets(input.organizationalKnowledge ?? [], 3)
}
