/** Phase 8B.1 — pure default-resolution helpers (client-safe, testable). */

import { GROWTH_INBOX_THREAD_QUEUE_VIEWS } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_OPPORTUNITIES_WORKSPACE_TABS,
  type GrowthOpportunitiesWorkspaceTab,
} from "@/lib/growth/navigation/growth-opportunities-workspace-navigation"
import {
  type GrowthCallsOperatingView,
  isGrowthCallsOperatingView,
} from "@/lib/growth/navigation/growth-workspace-consolidation"
import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthWorkspaceCallsDefaultView,
  type GrowthWorkspaceOpportunitiesDefaultTab,
  type GrowthWorkspaceSettingsDefaultViews,
} from "@/lib/growth/settings/growth-workspace-settings-types"
import type { GrowthInboxThreadQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"

export const GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER =
  "growth-workspace-settings-consumption-8b1-v1" as const

export function resolveGrowthInboxQueueViewFromUrl(input: {
  viewParam: string | null
  savedDefaultFilter?: GrowthInboxThreadQueueView | null
  fallback?: GrowthInboxThreadQueueView
}): GrowthInboxThreadQueueView {
  const fallback = input.fallback ?? "needs_action"
  if (input.viewParam && (GROWTH_INBOX_THREAD_QUEUE_VIEWS as readonly string[]).includes(input.viewParam)) {
    return input.viewParam as GrowthInboxThreadQueueView
  }
  if (input.savedDefaultFilter) return input.savedDefaultFilter
  return fallback
}

export function shouldApplyGrowthInboxSavedDefaultFilter(viewParam: string | null): boolean {
  return !viewParam
}

export type GrowthCallsDefaultViewDestination =
  | { kind: "operating_view"; view: GrowthCallsOperatingView }
  | { kind: "navigate"; href: string }
  | { kind: "none" }

export function resolveGrowthCallsDefaultViewDestination(
  callsDefaultView: GrowthWorkspaceCallsDefaultView = DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.callsDefaultView,
): GrowthCallsDefaultViewDestination {
  switch (callsDefaultView) {
    case "workspace":
      return { kind: "operating_view", view: "operate" }
    case "overview":
      return { kind: "operating_view", view: "overview" }
    case "live":
      return { kind: "navigate", href: `${GROWTH_WORKSPACE_BASE_PATH}/calls/live` }
    case "queue":
      return { kind: "navigate", href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue` }
    case "coaching":
      return { kind: "navigate", href: `${GROWTH_WORKSPACE_BASE_PATH}/calls/coaching` }
    default:
      return { kind: "none" }
  }
}

export function resolveGrowthCallsOperatingViewWithSavedDefault(input: {
  pathname: string
  viewParam: string | null
  savedCallsDefaultView?: GrowthWorkspaceCallsDefaultView | null
}): GrowthCallsOperatingView {
  if (
    input.pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/calls/live`) ||
    input.viewParam === "live"
  ) {
    return "live"
  }

  if (input.viewParam && isGrowthCallsOperatingView(input.viewParam)) {
    return input.viewParam
  }

  if (!input.viewParam && input.savedCallsDefaultView) {
    const destination = resolveGrowthCallsDefaultViewDestination(input.savedCallsDefaultView)
    if (destination.kind === "operating_view") return destination.view
  }

  return "operate"
}

export function shouldApplyGrowthCallsSavedDefault(input: {
  pathname: string
  viewParam: string | null
}): boolean {
  if (input.viewParam) return false
  return input.pathname === `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`
}

export function resolveGrowthOpportunitiesDefaultTabHref(
  opportunitiesDefaultTab: GrowthWorkspaceOpportunitiesDefaultTab = DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.opportunitiesDefaultTab,
): string | null {
  const tab = GROWTH_OPPORTUNITIES_WORKSPACE_TABS.find((entry) => entry.id === opportunitiesDefaultTab)
  if (!tab || tab.id === "overview") return null
  return tab.href
}

export function shouldApplyGrowthOpportunitiesSavedDefaultTab(pathname: string): boolean {
  return pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`
}

export function mergeGrowthWorkspaceDefaultViews(
  preferences: Partial<GrowthWorkspaceSettingsDefaultViews> | null | undefined,
): GrowthWorkspaceSettingsDefaultViews {
  return {
    inboxDefaultFilter:
      preferences?.inboxDefaultFilter ?? DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.inboxDefaultFilter,
    callsDefaultView:
      preferences?.callsDefaultView ?? DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.callsDefaultView,
    opportunitiesDefaultTab:
      preferences?.opportunitiesDefaultTab ??
      DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.opportunitiesDefaultTab,
  }
}

export type GrowthOpportunitiesWorkspaceTabId = GrowthOpportunitiesWorkspaceTab["id"]
