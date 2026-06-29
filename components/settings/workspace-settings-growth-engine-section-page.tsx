"use client"

import { notFound } from "next/navigation"
import dynamic from "next/dynamic"
import { WorkspaceSettingsPhasePlaceholder } from "@/components/settings/workspace-settings-phase-placeholder"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"
import {
  getGrowthEngineSectionClassification,
  rendersGrowthEnginePhasePlaceholder,
  resolveGrowthEngineSectionLiftKind,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER,
} from "@/lib/settings/workspace-settings-growth-engine-lift"
import {
  GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE,
  WorkspaceSettingsGrowthEngineIsolationPlaceholder,
} from "@/lib/settings/workspace-settings-growth-engine-isolation-placeholder"

const WorkspaceSettingsGrowthEngineLiftedPanelHost = dynamic(
  () =>
    import("@/components/settings/workspace-settings-growth-engine-lifted-panel-host").then((module) => ({
      default: module.WorkspaceSettingsGrowthEngineLiftedPanelHost,
    })),
  {
    loading: () => (
      <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading Growth Engine settings…
      </div>
    ),
    ssr: false,
  },
)

export function WorkspaceSettingsGrowthEngineSectionPage({ sectionId }: { sectionId: string }) {
  const section = getWorkspaceSettingsGrowthEngineSection(sectionId)
  if (!section) notFound()

  const liftKind = resolveGrowthEngineSectionLiftKind(sectionId)
  const classification = getGrowthEngineSectionClassification(sectionId)

  if (liftKind === "lifted") {
    if (GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE) {
      return (
        <div
          className="flex w-full min-w-0 max-w-none flex-col gap-6"
          data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER}
          data-workspace-settings-growth-engine-section={sectionId}
        >
          <WorkspaceSettingsGrowthEngineIsolationPlaceholder
            sectionId={sectionId}
            sectionLabel={section.label}
          />
        </div>
      )
    }

    return (
      <div
        className="flex w-full min-w-0 max-w-none flex-col gap-6"
        data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER}
        data-workspace-settings-growth-engine-section={sectionId}
      >
        <WorkspaceSettingsGrowthEngineLiftedPanelHost sectionId={sectionId} />
      </div>
    )
  }

  if (rendersGrowthEnginePhasePlaceholder(liftKind)) {
    return (
      <WorkspaceSettingsPhasePlaceholder
        section={section}
        icon={section.icon}
        phaseLabel="Phase 3"
        phaseDescription={
          classification?.reason ??
          "Remaining AI OS settings migrate in Phase 3 — no new implementations in GE-SET-5."
        }
      />
    )
  }

  notFound()
}
