/** Client-safe Growth Command Center navigation destinations and section anchors. */

import { GROWTH_CALLS_PRIMARY_HREF } from "@/lib/growth/navigation/growth-workspace-consolidation"
import { GROWTH_REVENUE_QUEUE_HREF } from "@/lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"

export type GrowthCommandNavLink = {
  label: string
  href: string
}

export type GrowthCommandSectionTab = {
  label: string
  anchor: string
}

export const GROWTH_COMMAND_JUMP_DESTINATIONS: readonly GrowthCommandNavLink[] = [
  { label: "Queue", href: GROWTH_REVENUE_QUEUE_HREF },
  { label: "Inbox", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox },
  { label: "Reply Workflow", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow },
  { label: "Meetings", href: "/admin/growth/meetings" },
  { label: "Call Queue", href: "/admin/growth/leads/queue" },
  { label: "Imports", href: "/admin/growth/imports" },
  { label: "Sequences", href: "/admin/growth/sequences" },
  { label: "Sequence Execution", href: "/admin/growth/sequences/execution" },
  { label: "Cadence Tasks", href: "/admin/growth/sequences/execution" },
  { label: "Pipeline", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline },
  { label: "Opportunities", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.opportunities },
  { label: "Revenue Operating", href: "/admin/growth/revenue-operating" },
  { label: "Customer Lifecycle", href: "/admin/growth/customer-lifecycle" },
  { label: "Dogfood Validation", href: "/admin/growth/dogfood" },
  { label: "Providers", href: "/admin/growth/providers" },
  { label: "Settings", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.settings },
] as const

export const GROWTH_COMMAND_SECTION_TABS: readonly GrowthCommandSectionTab[] = [
  { label: "Today", anchor: "cc-today" },
  { label: "Communication", anchor: "cc-communication" },
  { label: "Revenue", anchor: "cc-revenue" },
  { label: "Market", anchor: "cc-research" },
  { label: "Lifecycle", anchor: "cc-lifecycle" },
  { label: "Readiness", anchor: "cc-readiness" },
  { label: "Performance", anchor: "cc-performance" },
] as const

export const GROWTH_COMMAND_COMM_SECTION_LINKS: readonly GrowthCommandNavLink[] = [
  { label: "Queue", href: GROWTH_REVENUE_QUEUE_HREF },
  { label: "Calls", href: GROWTH_CALLS_PRIMARY_HREF },
  { label: "Meetings", href: "/admin/growth/meetings" },
  { label: "Cadence", href: "/admin/growth/sequences/execution" },
  { label: "Live monitor", href: "/admin/growth/calls/live" },
] as const

export const GROWTH_COMMAND_PIPELINE_SECTION_LINKS: readonly GrowthCommandNavLink[] = [
  { label: "Pipeline", href: GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline },
  { label: "Revenue Operating", href: "/admin/growth/revenue-operating" },
] as const

export const GROWTH_COMMAND_LIFECYCLE_SECTION_LINKS: readonly GrowthCommandNavLink[] = [
  { label: "Lifecycle", href: "/admin/growth/customer-lifecycle" },
] as const

export const GROWTH_COMMAND_DOGFOOD_SECTION_LINKS: readonly GrowthCommandNavLink[] = [
  { label: "Validation Center", href: "/admin/growth/dogfood" },
] as const

export function scrollToGrowthCommandSection(anchor: string): void {
  if (typeof document === "undefined") return
  document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })
}
