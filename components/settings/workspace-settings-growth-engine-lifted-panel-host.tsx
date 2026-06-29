"use client"

import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import {
  getWorkspaceSettingsGrowthEngineLiftedPanel,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER,
} from "@/components/settings/workspace-settings-growth-engine-lifted-panels"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"

export function WorkspaceSettingsGrowthEngineLiftedPanelHost({ sectionId }: { sectionId: string }) {
  const section = getWorkspaceSettingsGrowthEngineSection(sectionId)
  const Panel = getWorkspaceSettingsGrowthEngineLiftedPanel(sectionId)
  if (!Panel) return null

  return (
    <GrowthAdminWidgetErrorBoundary
      label={section?.label ?? sectionId}
      qaMarker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER}
    >
      <Panel />
    </GrowthAdminWidgetErrorBoundary>
  )
}
