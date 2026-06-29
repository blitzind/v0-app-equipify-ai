"use client"

import React, { type ComponentType } from "react"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_PANEL_TRACE_QA_MARKER =
  "workspace-settings-growth-engine-panel-trace-v1" as const

export type WorkspaceSettingsGrowthEnginePanelTraceEvent = {
  marker: typeof WORKSPACE_SETTINGS_GROWTH_ENGINE_PANEL_TRACE_QA_MARKER
  step: string
  sectionId?: string
  exportName?: string
  componentName?: string
  detail?: Record<string, unknown>
}

export function traceWorkspaceSettingsGrowthEnginePanel(
  step: string,
  detail?: Record<string, unknown>,
): void {
  const payload: WorkspaceSettingsGrowthEnginePanelTraceEvent = {
    marker: WORKSPACE_SETTINGS_GROWTH_ENGINE_PANEL_TRACE_QA_MARKER,
    step,
    ...detail,
  }
  console.error("[workspace-settings-growth-engine-panel-trace]", payload)
}

type WorkspaceSettingsGrowthEnginePanelRenderTraceBoundaryProps = {
  sectionId: string
  componentName: string
  children: React.ReactNode
}

type TraceBoundaryState = {
  hasError: boolean
  errorMessage: string | null
  errorName: string | null
  errorStack: string | null
  componentStack: string | null
}

export class WorkspaceSettingsGrowthEnginePanelRenderTraceBoundary extends React.Component<
  WorkspaceSettingsGrowthEnginePanelRenderTraceBoundaryProps,
  TraceBoundaryState
> {
  state: TraceBoundaryState = {
    hasError: false,
    errorMessage: null,
    errorName: null,
    errorStack: null,
    componentStack: null,
  }

  static getDerivedStateFromError(error: Error): Partial<TraceBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message?.trim() || "Unknown render error",
      errorName: error?.name ?? "Error",
      errorStack: error?.stack ?? null,
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    traceWorkspaceSettingsGrowthEnginePanel("render_trace_boundary_caught", {
      sectionId: this.props.sectionId,
      componentName: this.props.componentName,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      reactComponentStack: info.componentStack,
    })
    this.setState({ componentStack: info.componentStack ?? null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950"
          data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_PANEL_TRACE_QA_MARKER}
          data-workspace-settings-panel-trace-error={this.props.sectionId}
        >
          <p className="font-semibold">{this.props.componentName} render failed (trace boundary)</p>
          <p className="mt-1 text-xs opacity-90">{this.state.errorMessage}</p>
        </div>
      )
    }

    traceWorkspaceSettingsGrowthEnginePanel("render_trace_boundary_before_children", {
      sectionId: this.props.sectionId,
      componentName: this.props.componentName,
    })

    return this.props.children
  }
}

export function wrapWorkspaceSettingsGrowthEnginePanelForRenderTrace<P extends object>(
  sectionId: string,
  exportName: string,
  Inner: ComponentType<P>,
): ComponentType<P> {
  const componentName = Inner.displayName ?? Inner.name ?? exportName

  function TracedWorkspaceSettingsGrowthEnginePanel(props: P) {
    traceWorkspaceSettingsGrowthEnginePanel("dynamic_component_before_render", {
      sectionId,
      exportName,
      componentName,
    })

    return (
      <WorkspaceSettingsGrowthEnginePanelRenderTraceBoundary sectionId={sectionId} componentName={componentName}>
        <Inner {...props} />
      </WorkspaceSettingsGrowthEnginePanelRenderTraceBoundary>
    )
  }

  TracedWorkspaceSettingsGrowthEnginePanel.displayName = `TracedWorkspaceSettingsGrowthEnginePanel(${componentName})`
  return TracedWorkspaceSettingsGrowthEnginePanel
}
