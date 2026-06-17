/** Workspace navigation consolidation — unified Calls operating layer (client-safe). */

import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"

function isGrowthWorkspacePathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)
}

export const GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER = "growth-workspace-consolidation-v2" as const

export const GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER = "growth-calls-runtime-hardening-v1" as const

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

export function growthCallsOperatingBaseHref(pathname?: string | null): string {
  return isGrowthWorkspacePathname(pathname) ? `${GROWTH_WORKSPACE_BASE_PATH}/calls` : GROWTH_CALLS_PRIMARY_HREF
}

export function growthCallsOperatingHref(
  view: GrowthCallsOperatingView = "operate",
  pathname?: string | null,
): string {
  const base = growthCallsOperatingBaseHref(pathname)
  if (view === "operate") return base
  if (view === "live") {
    return isGrowthWorkspacePathname(pathname)
      ? `${GROWTH_WORKSPACE_BASE_PATH}/calls/live`
      : `${GROWTH_ADMIN_BASE_PATH}/calls/live`
  }
  return `${base}?view=overview`
}

/** Safe view resolution — invalid query values fall back to operate (never throw). */
export function resolveGrowthCallsOperatingView(input: {
  pathname: string
  viewParam: string | null
}): GrowthCallsOperatingView {
  if (
    input.pathname.startsWith(`${GROWTH_ADMIN_BASE_PATH}/calls/live`) ||
    input.pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/calls/live`)
  ) {
    return "live"
  }
  if (input.viewParam && !isGrowthCallsOperatingView(input.viewParam)) {
    logGrowthCallsRuntimeIssue("invalid_view_param", {
      pathname: input.pathname,
      viewParam: input.viewParam,
    })
  }
  if (isGrowthCallsOperatingView(input.viewParam)) return input.viewParam
  return "operate"
}

/** Client-safe diagnostic logging — no secrets, no stack traces in UI. */
export function logGrowthCallsRuntimeIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn("[growth-calls]", code, context)
}
