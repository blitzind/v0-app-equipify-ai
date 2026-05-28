/** Workspace navigation consolidation — unified Calls operating layer (client-safe). */

export const GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER = "growth-workspace-consolidation-v2" as const

export const GROWTH_CALLS_PRIMARY_HREF = "/admin/growth/calls/workspace" as const

export const GROWTH_WORKSPACE_GROUP_DESCRIPTION =
  "Daily operating surfaces — live communication, pipeline movement, and revenue execution." as const

export const GROWTH_CALLS_PAGE_TITLE = "Calls" as const

export const GROWTH_CALLS_PAGE_DESCRIPTION =
  "Unified call operations — dial, queue, embedded intelligence, briefing, and post-call review. Operator-controlled; no autonomous outreach." as const

export const GROWTH_CALLS_OPERATING_VIEWS = ["operate", "overview", "live"] as const

export type GrowthCallsOperatingView = (typeof GROWTH_CALLS_OPERATING_VIEWS)[number]

export function isGrowthCallsOperatingView(value: string | null | undefined): value is GrowthCallsOperatingView {
  return GROWTH_CALLS_OPERATING_VIEWS.includes(value as GrowthCallsOperatingView)
}

export function growthCallsOperatingHref(view: GrowthCallsOperatingView = "operate"): string {
  if (view === "operate") return GROWTH_CALLS_PRIMARY_HREF
  if (view === "live") return "/admin/growth/calls/live"
  return `${GROWTH_CALLS_PRIMARY_HREF}?view=overview`
}
