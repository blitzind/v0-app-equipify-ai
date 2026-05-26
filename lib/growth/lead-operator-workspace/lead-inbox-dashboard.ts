import { compareLeadInboxPriority } from "@/lib/growth/lead-inbox/lead-inbox-priority"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import {
  GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS,
  type GrowthLeadInboxCardView,
  type GrowthLeadInboxDashboardSection,
  type GrowthLeadInboxDashboardSectionPayload,
  type GrowthLeadInboxSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildLeadInboxCardView } from "@/lib/growth/lead-operator-workspace/lead-inbox-card-view"

const SECTION_LABELS: Record<GrowthLeadInboxDashboardSection, string> = {
  high_priority: "High Priority",
  needs_review: "Needs Review",
  enrichment_needed: "Enrichment Needed",
  approved: "Approved",
  pipeline_running: "Pipeline Running",
  archived: "Archived",
}

export function resolveInboxDashboardSection(row: GrowthLeadInboxRow): GrowthLeadInboxDashboardSection {
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
  a: GrowthLeadInboxCardView,
  b: GrowthLeadInboxCardView,
  mode: GrowthLeadInboxSortMode,
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
  rows: GrowthLeadInboxRow[],
  sort: GrowthLeadInboxSortMode = "priority",
): GrowthLeadInboxDashboardSectionPayload[] {
  const buckets = new Map<GrowthLeadInboxDashboardSection, GrowthLeadInboxCardView[]>()
  for (const section of GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS) {
    buckets.set(section, [])
  }

  const sortedRows = [...rows].sort(compareLeadInboxPriority)

  for (const row of sortedRows) {
    const section = resolveInboxDashboardSection(row)
    const card = buildLeadInboxCardView(row)
    buckets.get(section)!.push(card)
  }

  return GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS.map((id) => {
    const items = [...(buckets.get(id) ?? [])].sort((a, b) => compareBySortMode(a, b, sort))
    return { id, label: SECTION_LABELS[id], items }
  })
}
