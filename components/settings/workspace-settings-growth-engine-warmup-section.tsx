"use client"

import React, { Suspense, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { GrowthWarmupDashboardPanel } from "@/components/growth/growth-warmup-dashboard"
import { Button } from "@/components/ui/button"
import {
  GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER,
  sanitizeGrowthAdminUiError,
} from "@/lib/growth/admin-route-runtime-types"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_WARMUP_SECTION_QA_MARKER =
  "workspace-settings-growth-engine-warmup-section-v1" as const

const RUNTIME_LOG_PREFIX = "[warmup-runtime]"
const PANEL_ERROR_BOUNDARY_MARKER =
  "workspace-settings-growth-engine-warmup-panel-error-boundary-v1" as const
const PANEL_NAME = "GrowthWarmupDashboardPanel"

type WarmupPanelErrorBoundaryProps = {
  children: React.ReactNode
  onRetry?: () => void
}

type WarmupPanelErrorBoundaryState = {
  hasError: boolean
  errorMessage: string | null
}

class WarmupPanelErrorBoundary extends React.Component<
  WarmupPanelErrorBoundaryProps,
  WarmupPanelErrorBoundaryState
> {
  state: WarmupPanelErrorBoundaryState = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): WarmupPanelErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message?.trim() || "Unknown render error",
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[warmup-panel-error]", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
      panelName: PANEL_NAME,
    })
    console.error(`[${PANEL_ERROR_BOUNDARY_MARKER}] Warmup render failed`, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      reactComponentStack: info.componentStack,
    })
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null })
    this.props.onRetry?.()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          data-qa={GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER}
          data-qa-marker={PANEL_ERROR_BOUNDARY_MARKER}
        >
          <p className="font-semibold">Warmup unavailable</p>
          <p className="mt-1 text-xs opacity-90">
            {sanitizeGrowthAdminUiError(this.state.errorMessage)}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={this.handleRetry}>
            <RefreshCw className="mr-2 size-3.5" />
            Retry panel
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

function WarmupDashboardFallback() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
      Loading warmup…
    </div>
  )
}

function WarmupDashboardRender() {
  console.info("[warmup-render]")

  return <GrowthWarmupDashboardPanel />
}

export function WorkspaceSettingsGrowthEngineWarmupSection() {
  useEffect(() => {
    console.info("[warmup-mount]")

    function onError(event: ErrorEvent) {
      const err = event.error
      console.error(RUNTIME_LOG_PREFIX, {
        kind: "error",
        message: err instanceof Error ? err.message : event.message,
        stack: err instanceof Error ? err.stack : undefined,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      console.error(RUNTIME_LOG_PREFIX, {
        kind: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  const [retryKey, setRetryKey] = React.useState(0)

  return (
    <div
      data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_WARMUP_SECTION_QA_MARKER}
      data-workspace-settings-growth-engine-warmup-section="v1"
    >
      <WarmupPanelErrorBoundary onRetry={() => setRetryKey((key) => key + 1)}>
        <Suspense fallback={<WarmupDashboardFallback />}>
          <WarmupDashboardRender key={retryKey} />
        </Suspense>
      </WarmupPanelErrorBoundary>
    </div>
  )
}
