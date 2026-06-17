import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthWorkspaceFavoriteDestinations } from "@/lib/growth/settings/growth-workspace-settings-options"
import {
  DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES,
  type GrowthOperatorWorkspacePreferencesRecord,
  type GrowthOperatorWorkspacePreferencesUpsertInput,
} from "@/lib/growth/settings/growth-workspace-settings-types"
import type { GrowthInboxThreadQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import type {
  GrowthWorkspaceCallsDefaultView,
  GrowthWorkspaceOpportunitiesDefaultTab,
} from "@/lib/growth/settings/growth-workspace-settings-types"

const SELECT =
  "id, user_id, timezone, default_landing_page, compact_mode, reduced_motion, sidebar_collapsed, favorite_destinations, last_visited_route, inbox_default_filter, calls_default_view, opportunities_default_tab, created_at, updated_at"

type PreferencesRow = {
  id: string
  user_id: string
  timezone: string
  default_landing_page: string
  compact_mode: boolean
  reduced_motion: boolean
  sidebar_collapsed: boolean
  favorite_destinations: string[] | null
  last_visited_route: string | null
  inbox_default_filter: string
  calls_default_view: string
  opportunities_default_tab: string
  created_at: string
  updated_at: string
}

function preferencesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_workspace_preferences")
}

function mapRow(row: PreferencesRow): GrowthOperatorWorkspacePreferencesRecord {
  return {
    id: row.id,
    userId: row.user_id,
    timezone: row.timezone,
    defaultLandingPage: row.default_landing_page,
    compactMode: row.compact_mode,
    reducedMotion: row.reduced_motion,
    sidebarCollapsed: row.sidebar_collapsed,
    favoriteDestinations: normalizeGrowthWorkspaceFavoriteDestinations(row.favorite_destinations ?? []),
    lastVisitedRoute: row.last_visited_route,
    inboxDefaultFilter: row.inbox_default_filter as GrowthInboxThreadQueueView,
    callsDefaultView: row.calls_default_view as GrowthWorkspaceCallsDefaultView,
    opportunitiesDefaultTab: row.opportunities_default_tab as GrowthWorkspaceOpportunitiesDefaultTab,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getWorkspacePreferencesForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthOperatorWorkspacePreferencesRecord | null> {
  const { data, error } = await preferencesTable(admin).select(SELECT).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as PreferencesRow)
}

export function resolveEffectiveWorkspacePreferences(
  record: GrowthOperatorWorkspacePreferencesRecord | null,
): Omit<GrowthOperatorWorkspacePreferencesRecord, "id" | "userId" | "createdAt" | "updatedAt"> {
  if (!record) return { ...DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES }
  return {
    timezone: record.timezone,
    defaultLandingPage: record.defaultLandingPage,
    compactMode: record.compactMode,
    reducedMotion: record.reducedMotion,
    sidebarCollapsed: record.sidebarCollapsed,
    favoriteDestinations: [...record.favoriteDestinations],
    lastVisitedRoute: record.lastVisitedRoute,
    inboxDefaultFilter: record.inboxDefaultFilter,
    callsDefaultView: record.callsDefaultView,
    opportunitiesDefaultTab: record.opportunitiesDefaultTab,
  }
}

export async function upsertWorkspacePreferencesForUser(
  admin: SupabaseClient,
  userId: string,
  input: GrowthOperatorWorkspacePreferencesUpsertInput,
): Promise<GrowthOperatorWorkspacePreferencesRecord> {
  const existing = await getWorkspacePreferencesForUser(admin, userId)
  const effective = resolveEffectiveWorkspacePreferences(existing)

  const payload = {
    user_id: userId,
    timezone: input.timezone ?? effective.timezone,
    default_landing_page: input.defaultLandingPage ?? effective.defaultLandingPage,
    compact_mode: input.compactMode ?? effective.compactMode,
    reduced_motion: input.reducedMotion ?? effective.reducedMotion,
    sidebar_collapsed: input.sidebarCollapsed ?? effective.sidebarCollapsed,
    favorite_destinations: normalizeGrowthWorkspaceFavoriteDestinations(
      input.favoriteDestinations ?? effective.favoriteDestinations,
    ),
    last_visited_route:
      input.lastVisitedRoute !== undefined ? input.lastVisitedRoute : effective.lastVisitedRoute,
    inbox_default_filter: input.inboxDefaultFilter ?? effective.inboxDefaultFilter,
    calls_default_view: input.callsDefaultView ?? effective.callsDefaultView,
    opportunities_default_tab: input.opportunitiesDefaultTab ?? effective.opportunitiesDefaultTab,
  }

  const { data, error } = await preferencesTable(admin)
    .upsert(payload, { onConflict: "user_id" })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as PreferencesRow)
}
