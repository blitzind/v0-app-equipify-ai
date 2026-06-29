"use client"

import React from "react"

export const WORKSPACE_SETTINGS_NAV_ERROR_BOUNDARY_QA_MARKER =
  "workspace-settings-nav-error-boundary-v1" as const

type Props = {
  children: React.ReactNode
  variant: "mobile" | "desktop"
}

type State = {
  error: Error | null
}

export class WorkspaceSettingsNavErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[growth-settings-post-mount-error]", {
      kind: "react_render",
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      surface: `WorkspaceSettingsNav:${this.props.variant}`,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          data-qa-marker={WORKSPACE_SETTINGS_NAV_ERROR_BOUNDARY_QA_MARKER}
          data-workspace-settings-nav-error-boundary={this.props.variant}
        >
          Settings navigation failed to load ({this.props.variant}).
        </div>
      )
    }

    return this.props.children
  }
}
