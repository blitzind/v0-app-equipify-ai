/** Phase 8B — Growth workspace operator settings types (client-safe). */

import type { GrowthInboxThreadQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import type { GrowthOperatorNotificationEffectivePreferences } from "@/lib/growth/notifications/growth-notification-preferences-types"

export const GROWTH_WORKSPACE_SETTINGS_QA_MARKER = "growth-workspace-settings-persistence-8b-v1" as const

export const GROWTH_WORKSPACE_SETTINGS_MIGRATION =
  "20270828120000_growth_operator_workspace_preferences_8b.sql" as const

export const GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS = [
  "profile",
  "notifications",
  "personal-preferences",
  "sidebar-preferences",
  "default-views",
] as const

export type GrowthWorkspaceSettingsPersistedSectionId =
  (typeof GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS)[number]

export function isGrowthWorkspaceSettingsPersistedSection(
  sectionId: string,
): sectionId is GrowthWorkspaceSettingsPersistedSectionId {
  return (GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS as readonly string[]).includes(sectionId)
}

export type GrowthWorkspaceCallsDefaultView = "workspace" | "queue" | "live" | "coaching" | "overview"

export type GrowthWorkspaceOpportunitiesDefaultTab = "overview" | "pipeline" | "readiness"

export type GrowthOperatorWorkspacePreferencesRecord = {
  id: string
  userId: string
  timezone: string
  defaultLandingPage: string
  compactMode: boolean
  reducedMotion: boolean
  sidebarCollapsed: boolean
  favoriteDestinations: string[]
  lastVisitedRoute: string | null
  inboxDefaultFilter: GrowthInboxThreadQueueView
  callsDefaultView: GrowthWorkspaceCallsDefaultView
  opportunitiesDefaultTab: GrowthWorkspaceOpportunitiesDefaultTab
  createdAt: string
  updatedAt: string
}

export type GrowthOperatorWorkspacePreferencesUpsertInput = {
  timezone?: string
  defaultLandingPage?: string
  compactMode?: boolean
  reducedMotion?: boolean
  sidebarCollapsed?: boolean
  favoriteDestinations?: string[]
  lastVisitedRoute?: string | null
  inboxDefaultFilter?: GrowthInboxThreadQueueView
  callsDefaultView?: GrowthWorkspaceCallsDefaultView
  opportunitiesDefaultTab?: GrowthWorkspaceOpportunitiesDefaultTab
}

export type GrowthWorkspaceSettingsProfile = {
  userId: string
  displayName: string
  jobTitle: string
  timezone: string
  avatarUrl: string
  email: string
}

export type GrowthWorkspaceSettingsProfilePatch = {
  displayName?: string
  jobTitle?: string
  timezone?: string
  avatarUrl?: string | null
}

export type GrowthWorkspaceSettingsNotificationPreferences = GrowthOperatorNotificationEffectivePreferences & {
  emailNotificationsEnabled: boolean
}

export type GrowthWorkspaceSettingsPersonalPreferences = {
  defaultLandingPage: string
  compactMode: boolean
  reducedMotion: boolean
}

export type GrowthWorkspaceSettingsSidebarPreferences = {
  sidebarCollapsed: boolean
  favoriteDestinations: string[]
  lastVisitedRoute: string | null
}

export type GrowthWorkspaceSettingsDefaultViews = {
  inboxDefaultFilter: GrowthInboxThreadQueueView
  callsDefaultView: GrowthWorkspaceCallsDefaultView
  opportunitiesDefaultTab: GrowthWorkspaceOpportunitiesDefaultTab
}

export const DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES: Omit<
  GrowthOperatorWorkspacePreferencesRecord,
  "id" | "userId" | "createdAt" | "updatedAt"
> = {
  timezone: "UTC",
  defaultLandingPage: "/growth/inbox",
  compactMode: false,
  reducedMotion: false,
  sidebarCollapsed: false,
  favoriteDestinations: [],
  lastVisitedRoute: null,
  inboxDefaultFilter: "all",
  callsDefaultView: "workspace",
  opportunitiesDefaultTab: "overview",
}
