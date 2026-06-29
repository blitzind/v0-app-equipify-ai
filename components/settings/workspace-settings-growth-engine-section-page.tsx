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
import { traceWorkspaceSettingsGrowthEnginePanel } from "@/lib/settings/workspace-settings-growth-engine-panel-trace"

const WorkspaceSettingsGrowthEngineLiftedPanelHost = dynamic(
  async () => {
    traceWorkspaceSettingsGrowthEnginePanel("section_page_dynamic_host_import_start")
    try {
      const module = await import("@/components/settings/workspace-settings-growth-engine-lifted-panel-host")
      traceWorkspaceSettingsGrowthEnginePanel("section_page_dynamic_host_import_resolved", {
        moduleKeys: Object.keys(module ?? {}),
        hostType: typeof module.WorkspaceSettingsGrowthEngineLiftedPanelHost,
      })
      if (typeof module.WorkspaceSettingsGrowthEngineLiftedPanelHost !== "function") {
        throw new Error("WorkspaceSettingsGrowthEngineLiftedPanelHost export is not a function")
      }
      return { default: module.WorkspaceSettingsGrowthEngineLiftedPanelHost }
    } catch (error) {
      traceWorkspaceSettingsGrowthEnginePanel("section_page_dynamic_host_import_failed", {
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : null,
      })
      throw error
    }
  },
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
  traceWorkspaceSettingsGrowthEnginePanel("section_page_entering", { sectionId })

  const section = getWorkspaceSettingsGrowthEngineSection(sectionId)
  if (!section) notFound()

  const liftKind = resolveGrowthEngineSectionLiftKind(sectionId)
  const classification = getGrowthEngineSectionClassification(sectionId)

  traceWorkspaceSettingsGrowthEnginePanel("section_page_lift_kind", { sectionId, liftKind })

  if (liftKind === "lifted") {
    traceWorkspaceSettingsGrowthEnginePanel("section_page_before_host_render", { sectionId })
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
