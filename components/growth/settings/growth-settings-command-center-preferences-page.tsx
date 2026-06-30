"use client"

import type { ReactNode } from "react"
import { Command } from "lucide-react"
import { GrowthAiSettingsReadinessSummary } from "@/components/growth/settings/growth-ai-settings-readiness-summary"
import { GrowthSettingsSidebarPreferencesPanel } from "@/components/growth/settings/growth-settings-sidebar-preferences-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"

export const GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-command-center-preferences-ia-1b-v1" as const

function CommandCenterSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const sectionId = `command-center-section-${title.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <section className="space-y-3" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GrowthSettingsCommandCenterPreferencesPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PAGE_QA_MARKER}
      data-growth-settings-ai-refinement={GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Command Center Preferences"
        description="Pin destinations, startup behavior, and quick navigation for Cmd+K."
        icon={Command}
      />

      <GrowthAiSettingsReadinessSummary scope="command-center" />

      <CommandCenterSection
        title="Quick navigation"
        description="Favorite destinations appear in Cmd+K and quick navigation menus."
      >
        <GrowthSettingsSidebarPreferencesPanel variant="command-center" embedded />
      </CommandCenterSection>
    </div>
  )
}
