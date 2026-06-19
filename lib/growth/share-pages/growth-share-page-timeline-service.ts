/** Growth Engine SP-UX-2 — Operator workspace timeline assembly (server-only). */

import "server-only"

import type {
  GrowthSharePage,
  GrowthSharePageEvent,
  GrowthSharePageEventType,
} from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthSharePageOperatorTimelineEntry,
  GrowthSharePageOperatorWorkspaceOperatorState,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function mapEventKind(eventType: GrowthSharePageEventType): GrowthSharePageOperatorTimelineEntry["kind"] | null {
  switch (eventType) {
    case "SHARE_PAGE_VIEWED":
      return "viewed"
    case "SHARE_PAGE_CTA_CLICKED":
      return "cta_clicked"
    case "SHARE_PAGE_BOOKING_STARTED":
    case "SHARE_PAGE_BOOKING_COMPLETED":
      return "calendar_clicked"
    default:
      return null
  }
}

export function buildGrowthSharePageOperatorTimeline(input: {
  page: GrowthSharePage
  operatorState: GrowthSharePageOperatorWorkspaceOperatorState
  recentEvents: GrowthSharePageEvent[]
}): GrowthSharePageOperatorTimelineEntry[] {
  const entries: GrowthSharePageOperatorTimelineEntry[] = []

  entries.push({
    id: `${input.page.id}:created`,
    kind: "page_created",
    title: "Page created",
    summary: "Share page draft created for operator review.",
    occurredAt: input.page.createdAt,
  })

  if (input.operatorState.draftApprovedAt) {
    entries.push({
      id: `${input.page.id}:operator-approved`,
      kind: "approved",
      title: "Draft approved",
      summary: "Operator approved the share page draft (not published).",
      occurredAt: input.operatorState.draftApprovedAt,
    })
  } else if (input.page.approvedAt && input.page.status !== "published") {
    entries.push({
      id: `${input.page.id}:approved`,
      kind: "approved",
      title: "Draft approved",
      summary: "Share page marked approved by operator.",
      occurredAt: input.page.approvedAt,
    })
  }

  if (input.page.publishedAt) {
    entries.push({
      id: `${input.page.id}:published`,
      kind: "published",
      title: "Published",
      summary: "Share page published for passive delivery.",
      occurredAt: input.page.publishedAt,
    })
  }

  if (input.operatorState.lastPersonalizationRebuildAt) {
    entries.push({
      id: `${input.page.id}:rebuild`,
      kind: "personalization_rebuilt",
      title: "Personalization rebuilt",
      summary: "Personalization context regenerated for operator review.",
      occurredAt: input.operatorState.lastPersonalizationRebuildAt,
    })
  }

  if (input.page.archivedAt) {
    entries.push({
      id: `${input.page.id}:archived`,
      kind: "archived",
      title: "Archived",
      summary: "Share page archived by operator.",
      occurredAt: input.page.archivedAt,
    })
  }

  for (const event of input.recentEvents) {
    const kind = mapEventKind(event.eventType)
    if (!kind) continue
    entries.push({
      id: event.id,
      kind,
      title:
        kind === "viewed"
          ? "Viewed"
          : kind === "cta_clicked"
            ? "CTA clicked"
            : "Calendar clicked",
      summary: event.eventLabel || kind.replace(/_/g, " "),
      occurredAt: event.occurredAt,
    })
  }

  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}
