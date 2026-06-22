/** GS-AI-PLAYBOOK-5B/5C — Activity center filter + search helpers (client-safe). */

import type {
  GrowthActivityEventView,
  GrowthActivityFilterId,
  GrowthActivityRailCardView,
} from "@/lib/growth/activity/growth-activity-workspace-types"

function isWithinDays(iso: string, days: number): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return date.getTime() >= cutoff
}

function isToday(iso: string): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function filterGrowthActivityEvents(
  events: GrowthActivityEventView[],
  filterId: GrowthActivityFilterId,
  context?: { currentUserId?: string | null },
): GrowthActivityEventView[] {
  switch (filterId) {
    case "today":
      return events.filter((event) => isToday(event.occurredAt))
    case "this-week":
      return events.filter((event) => isWithinDays(event.occurredAt, 7))
    case "high-intent":
      return events.filter((event) => (event.score ?? 0) >= 70)
    case "needs-attention":
    case "needs-follow-up":
      return events.filter(
        (event) =>
          event.urgency === "high" ||
          event.urgency === "critical" ||
          event.metadata.isUnread === true,
      )
    case "unread":
      return events.filter((event) => event.metadata.isUnread === true)
    case "my-leads":
      if (!context?.currentUserId) return events
      return events.filter((event) => event.metadata.ownerUserId === context.currentUserId)
    case "personalization":
    case "ai-events":
      return events.filter((event) => event.category === "personalization")
    case "communication":
      return events.filter((event) => event.category === "communication")
    case "content":
      return events.filter((event) => event.category === "content")
    case "sales":
      return events.filter((event) => event.category === "sales")
    case "intelligence":
      return events.filter((event) => event.category === "intelligence")
    case "my-activity":
    case "all":
    default:
      return events
  }
}

export function searchGrowthActivityEvents(
  events: GrowthActivityEventView[],
  query: string,
): GrowthActivityEventView[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return events
  return events.filter((event) => {
    const haystack = [
      event.title,
      event.description,
      event.leadName,
      event.companyName,
      event.landingPageTitle,
      event.source,
      event.metadata.rawEventType,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function filterGrowthActivityRailCards(
  cards: GrowthActivityRailCardView[],
  filterId: GrowthActivityFilterId,
): GrowthActivityRailCardView[] {
  if (filterId === "needs-attention" || filterId === "needs-follow-up") {
    return cards.filter((card) => card.queueId === "needs-attention" || card.score >= 55)
  }
  if (filterId === "high-intent") {
    return cards.filter((card) => card.score >= 70)
  }
  return cards
}

/** @deprecated Use filterGrowthActivityRailCards */
export const filterGrowthActivityHighIntentProspects = filterGrowthActivityRailCards
