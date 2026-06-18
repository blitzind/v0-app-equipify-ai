/**
 * Workspace Settings — Growth Operator section manifest (Phase GE-SET-3).
 *
 * Five persisted operator preference panels lifted from /growth/settings/*.
 */

import type { LucideIcon } from "lucide-react"
import { Bell, Eye, PanelLeft, SlidersHorizontal, User } from "lucide-react"
import type { GrowthWorkspaceSettingsPersistedSectionId } from "@/lib/growth/settings/growth-workspace-settings-types"
import { GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS } from "@/lib/growth/settings/growth-workspace-settings-types"

export const WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER = "workspace-settings-growth-operator-ge-set-3-v1" as const

export const WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE = "/settings/growth-operator" as const

export const WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID = "profile" as const

export type WorkspaceSettingsGrowthOperatorSection = {
  id: GrowthWorkspaceSettingsPersistedSectionId
  label: string
  description: string
  href: string
  icon: LucideIcon
}

const GROWTH_OPERATOR_SECTION_META: Record<
  GrowthWorkspaceSettingsPersistedSectionId,
  Omit<WorkspaceSettingsGrowthOperatorSection, "id" | "href">
> = {
  profile: {
    label: "Profile",
    description: "Operator identity and display preferences for the Growth workspace.",
    icon: User,
  },
  notifications: {
    label: "Notifications",
    description: "In-app and delivery preferences for Growth operator alerts.",
    icon: Bell,
  },
  "personal-preferences": {
    label: "Personal Preferences",
    description: "Personal defaults that follow you across Growth workspaces.",
    icon: SlidersHorizontal,
  },
  "sidebar-preferences": {
    label: "Sidebar Preferences",
    description: "Collapse behavior and section defaults for the Growth sidebar.",
    icon: PanelLeft,
  },
  "default-views": {
    label: "Default Views",
    description: "Landing views and default filters when opening Growth destinations.",
    icon: Eye,
  },
}

function growthOperatorHref(sectionId: GrowthWorkspaceSettingsPersistedSectionId): string {
  return `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${sectionId}`
}

export const WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS: WorkspaceSettingsGrowthOperatorSection[] =
  GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS.map((id) => ({
    id,
    href: growthOperatorHref(id),
    ...GROWTH_OPERATOR_SECTION_META[id],
  }))

export function listWorkspaceSettingsGrowthOperatorSectionIds(): GrowthWorkspaceSettingsPersistedSectionId[] {
  return [...GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS]
}

export function getWorkspaceSettingsGrowthOperatorSection(
  sectionId: string,
): WorkspaceSettingsGrowthOperatorSection | null {
  return WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS.find((section) => section.id === sectionId) ?? null
}

export function isWorkspaceSettingsGrowthOperatorSectionActive(
  pathname: string,
  section: WorkspaceSettingsGrowthOperatorSection,
): boolean {
  return pathname === section.href || pathname.startsWith(`${section.href}/`)
}
