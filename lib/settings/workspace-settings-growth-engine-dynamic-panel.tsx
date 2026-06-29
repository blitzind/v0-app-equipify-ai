"use client"

import type { ComponentType } from "react"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER =
  "workspace-settings-growth-engine-dynamic-panel-v2" as const

export type WorkspaceSettingsGrowthEngineDynamicPanelModule = {
  default?: ComponentType
  [exportName: string]: ComponentType | undefined
}

export function logWorkspaceSettingsGrowthEnginePanelDiagnostic(
  sectionId: string,
  detail: Record<string, unknown>,
): void {
  const payload = {
    marker: WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER,
    sectionId,
    ...detail,
  }
  if (process.env.NODE_ENV === "development") {
    console.info("[workspace-settings-growth-engine-panel]", payload)
  } else {
    console.error("[workspace-settings-growth-engine-panel]", payload)
  }
}

export function resolveWorkspaceSettingsGrowthEngineDynamicExport(
  sectionId: string,
  exportName: string,
  module: WorkspaceSettingsGrowthEngineDynamicPanelModule | null | undefined,
): ComponentType | null {
  const defaultExport = module?.default
  if (typeof defaultExport === "function") {
    return defaultExport
  }

  const namedExport = module?.[exportName]
  if (typeof namedExport === "function") {
    return namedExport
  }

  logWorkspaceSettingsGrowthEnginePanelDiagnostic(sectionId, {
    event: "invalid_dynamic_export",
    exportName,
    exportType: typeof namedExport,
    defaultType: typeof defaultExport,
    moduleKeys: Object.keys(module ?? {}),
  })
  return null
}

export function createWorkspaceSettingsGrowthEnginePanelFallback(
  label: string,
  sectionId: string,
  reason?: string,
): ComponentType {
  function WorkspaceSettingsGrowthEnginePanelFallback() {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
        data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER}
        data-workspace-settings-panel-section={sectionId}
      >
        <p className="font-semibold">{label} could not be loaded</p>
        <p className="mt-1 text-xs opacity-90">
          {reason ??
            "The settings panel module did not load correctly. Retry or contact support if this persists after deploy."}
        </p>
      </div>
    )
  }

  WorkspaceSettingsGrowthEnginePanelFallback.displayName = `WorkspaceSettingsGrowthEnginePanelFallback(${sectionId})`
  return WorkspaceSettingsGrowthEnginePanelFallback
}
