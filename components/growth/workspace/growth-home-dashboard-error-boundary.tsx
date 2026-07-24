"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE } from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import {
  AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER,
  logGrowthHomeMountStage,
} from "@/lib/growth/home/growth-home-mount-diagnostics-2b-1d"
import { GROWTH_WORKSPACE_DASHBOARD_QA_MARKER } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

type GrowthHomeDashboardErrorBoundaryProps = {
  children: ReactNode
}

type GrowthHomeDashboardErrorBoundaryState = {
  hasError: boolean
  message: string | null
  retryKey: number
}

export class GrowthHomeDashboardErrorBoundary extends Component<
  GrowthHomeDashboardErrorBoundaryProps,
  GrowthHomeDashboardErrorBoundaryState
> {
  state: GrowthHomeDashboardErrorBoundaryState = {
    hasError: false,
    message: null,
    retryKey: 0,
  }

  static getDerivedStateFromError(error: unknown): Partial<GrowthHomeDashboardErrorBoundaryState> {
    const message = error instanceof Error ? error.message : "Unexpected Home dashboard error."
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const errorName = error instanceof Error ? error.name : "Error"
    const errorMessage = error instanceof Error ? error.message : "unknown"
    const componentStack = info.componentStack?.split("\n").slice(0, 5).join(" | ") ?? null

    console.error("[growth/home/dashboard-render-error]", {
      qaMarker: AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER,
      errorName,
      errorMessage,
      componentStack,
    })

    logGrowthHomeMountStage("dashboard_body_rendered", {
      render_error: true,
      errorName,
      errorMessage,
      componentStack,
    })
  }

  private handleRetry = (): void => {
    this.setState((current) => ({
      hasError: false,
      message: null,
      retryKey: current.retryKey + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="space-y-6"
          data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QA_MARKER}
          data-growth-home-executive-unavailable="true"
          data-growth-home-dashboard-error-boundary={AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
            <div className="space-y-1">
              <p>{GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE}</p>
              {this.state.message ? (
                <p className="text-xs text-amber-900/80">{this.state.message}</p>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        </div>
      )
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}
