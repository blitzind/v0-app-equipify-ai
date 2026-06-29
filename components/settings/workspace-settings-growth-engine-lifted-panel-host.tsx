"use client"

import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import {
  getWorkspaceSettingsGrowthEngineLiftedPanel,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER,
} from "@/components/settings/workspace-settings-growth-engine-lifted-panels"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"
import { traceWorkspaceSettingsGrowthEnginePanel } from "@/lib/settings/workspace-settings-growth-engine-panel-trace"

export function WorkspaceSettingsGrowthEngineLiftedPanelHost({ sectionId }: { sectionId: string }) {
  traceWorkspaceSettingsGrowthEnginePanel("host_entering", { sectionId })

  const section = getWorkspaceSettingsGrowthEngineSection(sectionId)
  const Panel = getWorkspaceSettingsGrowthEngineLiftedPanel(sectionId)

  traceWorkspaceSettingsGrowthEnginePanel("host_panel_resolved", {
    sectionId,
    panelFound: Boolean(Panel),
    panelName: Panel?.displayName ?? Panel?.name ?? null,
    sectionLabel: section?.label ?? null,
  })

  if (!Panel) {
    traceWorkspaceSettingsGrowthEnginePanel("host_panel_missing", { sectionId })
    return null
  }

  traceWorkspaceSettingsGrowthEnginePanel("host_before_render_panel", {
    sectionId,
    panelName: Panel.displayName ?? Panel.name ?? "anonymous",
  })

  return (
    <GrowthAdminWidgetErrorBoundary
      label={section?.label ?? sectionId}
      qaMarker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER}
    >
      <Panel />
    </GrowthAdminWidgetErrorBoundary>
  )
}
