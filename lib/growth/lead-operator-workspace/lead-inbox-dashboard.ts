import { compareLeadInboxPriority } from "@/lib/growth/lead-inbox/lead-inbox-priority"
import type { RevenueQueueRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import {
  GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS,
  type RevenueQueueCardView,
  type RevenueQueueDashboardSection,
  type RevenueQueueDashboardSectionPayload,
  type RevenueQueueSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildRevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-inbox-card-view"

const SECTION_LABELS: Record<RevenueQueueDashboardSection, string> = {
  high_priority: "High Priority",
  needs_review: "Needs Review",
  enrichment_needed: "Enrichment Needed",
  approved: "Approved",
  pipeline_running: "Pipeline Running",
  archived: "Archived",
}

export function resolveInboxDashboardSection(row: RevenueQueueRow): RevenueQueueDashboardSection {
  if (row.status === "archived" || row.status === "disqualified" || row.status === "duplicate") {
    return "archived"
  }
  if (row.status === "running_pipeline" || row.pipeline_status === "running") {
    return "pipeline_running"
  }
  if (row.status === "approved") return "approved"
  if (row.status === "enriching") return "enrichment_needed"

  if (row.human_review_required && (row.status === "new" || row.status === "reviewing")) {
    return "needs_review"
  }

  if (
    row.candidate_priority === "urgent" ||
    row.candidate_priority === "high" ||
    row.intent_score >= 75
  ) {
    return "high_priority"
  }

  if (row.status === "new" || row.status === "reviewing") return "needs_review"
  if (row.status === "pipeline_complete") return "approved"

  return "needs_review"
}

function compareBySortMode(
  a: RevenueQueueCardView,
  b: RevenueQueueCardView,
  mode: RevenueQueueSortMode,
): number {
  if (mode === "intent") {
    const delta = b.intent_score - a.intent_score
    if (delta !== 0) return delta
  }
  if (mode === "confidence") {
    const delta = b.candidate_confidence - a.candidate_confidence
    if (delta !== 0) return delta
  }
  if (mode === "recent_activity") {
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  }
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const pa = priorityRank[a.candidate_priority] ?? 2
  const pb = priorityRank[b.candidate_priority] ?? 2
  if (pa !== pb) return pa - pb
  const scoreDelta = (b.lead_score ?? b.intent_score) - (a.lead_score ?? a.intent_score)
  if (scoreDelta !== 0) return scoreDelta
  return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
}

export function buildLeadInboxDashboardSections(
  rows: RevenueQueueRow[],
  sort: RevenueQueueSortMode = "priority",
): RevenueQueueDashboardSectionPayload[] {
  const buckets = new Map<RevenueQueueDashboardSection, RevenueQueueCardView[]>()
  for (const section of GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS) {
    buckets.set(section, [])
  }

  const sortedRows = [...rows].sort(compareLeadInboxPriority)

  for (const row of sortedRows) {
    const section = resolveInboxDashboardSection(row)
    const card = buildRevenueQueueCardView(row)
    buckets.get(section)!.push(card)
  }

  return GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS.map((id) => {
    const items = [...(buckets.get(id) ?? [])].sort((a, b) => compareBySortMode(a, b, sort))
    return { id, label: SECTION_LABELS[id], items }
  })
}
