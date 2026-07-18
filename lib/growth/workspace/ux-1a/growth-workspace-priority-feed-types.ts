/** GE-AIOS-UX-1A Phase 2 — Workspace priority feed read model (client-safe). */

export const GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER =
  "ge-aios-ux-1a-workspace-priority-feed-v1" as const

export type GrowthWorkspacePriorityFeedKind = "action" | "blocker" | "info"

export type GrowthWorkspaceProgressStatus =
  | "prepared"
  | "ready_for_review"
  | "queued"
  | "delivered"

export type GrowthWorkspacePriorityItem = {
  id: string
  title: string
  subtitle: string
  href: string | null
  kind: GrowthWorkspacePriorityFeedKind
  severity: number
  actionLabel: string
}

export type GrowthWorkspacePrimaryAction = {
  id: string
  label: string
  href: string
  description?: string
}

export type GrowthWorkspaceProgressItem = {
  id: string
  label: string
  status: GrowthWorkspaceProgressStatus
}

export type GrowthWorkspacePriorityFeedHero = {
  greeting: string
  subline: string
  readyCount: number
  teammateNamedInSubline: boolean
}

export type GrowthWorkspacePriorityFeedViewModel = {
  qaMarker: typeof GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER
  hero: GrowthWorkspacePriorityFeedHero
  priorities: GrowthWorkspacePriorityItem[]
  primaryActions: GrowthWorkspacePrimaryAction[]
  recentProgress: GrowthWorkspaceProgressItem[]
  isCaughtUp: boolean
  caughtUpTitle: string
  caughtUpMessage: string
}
