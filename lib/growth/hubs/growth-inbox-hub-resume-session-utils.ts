import type { GrowthInboxActivityItem } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"
import { formatGrowthInboxActivityRelativeTime } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"

export const GROWTH_INBOX_HUB_RESUME_SESSION_QA_MARKER = "growth-inbox-hub-resume-session-v1" as const

export type GrowthInboxResumeSessionView = {
  category: string
  title: string
  relativeTime: string
  href: string
}

const KIND_LABELS: Record<GrowthInboxActivityItem["kind"], string> = {
  thread: "Last thread opened",
  lead: "Last lead viewed",
  meeting: "Last meeting viewed",
  workflow: "Last workflow inspected",
}

export function buildGrowthInboxResumeSessionView(
  item: GrowthInboxActivityItem | undefined,
): GrowthInboxResumeSessionView | null {
  if (!item) return null
  return {
    category: KIND_LABELS[item.kind],
    title: item.label,
    relativeTime: formatGrowthInboxActivityRelativeTime(item.viewedAt),
    href: item.href,
  }
}
