"use client"

import React from "react"

export const WORKSPACE_SETTINGS_NAV_ERROR_BOUNDARY_QA_MARKER =
  "workspace-settings-nav-error-boundary-v1" as const

type Props = {
  children: React.ReactNode
  variant: "mobile" | "desktop"
  pathname: string
  isPlatformAdmin: boolean
  growthCategoryLoaded: boolean
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
    console.error("[workspace-settings-nav-error]", {
      error,
      message: error?.message,
      stack: error?.stack,
      componentStack: info.componentStack,
      pathname: this.props.pathname,
      isPlatformAdmin: this.props.isPlatformAdmin,
      growthCategoryLoaded: this.props.growthCategoryLoaded,
      variant: this.props.variant,
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
