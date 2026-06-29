"use client"

import React, { useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { GrowthDeliverabilityDashboard } from "@/components/growth/growth-deliverability-dashboard"
import { Button } from "@/components/ui/button"
import {
  GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER,
  sanitizeGrowthAdminUiError,
} from "@/lib/growth/admin-route-runtime-types"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DNS_VERIFICATION_SECTION_QA_MARKER =
  "workspace-settings-growth-engine-dns-verification-section-v1" as const

const RUNTIME_LOG_PREFIX = "[dns-verification-runtime]"
const PANEL_ERROR_BOUNDARY_MARKER =
  "workspace-settings-growth-engine-dns-verification-panel-error-boundary-v1" as const
const PANEL_NAME = "GrowthDeliverabilityDashboard"

type DnsVerificationPanelErrorBoundaryProps = {
  children: React.ReactNode
  onRetry?: () => void
}

type DnsVerificationPanelErrorBoundaryState = {
  hasError: boolean
  errorMessage: string | null
}

class DnsVerificationPanelErrorBoundary extends React.Component<
  DnsVerificationPanelErrorBoundaryProps,
  DnsVerificationPanelErrorBoundaryState
> {
  state: DnsVerificationPanelErrorBoundaryState = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): DnsVerificationPanelErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message?.trim() || "Unknown render error",
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[dns-verification-panel-error]", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
      panelName: PANEL_NAME,
    })
    console.error(`[${PANEL_ERROR_BOUNDARY_MARKER}] DNS verification render failed`, {
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
          <p className="font-semibold">DNS verification unavailable</p>
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

function DnsVerificationDashboardRender() {
  console.info("[dns-verification-render]")

  return <GrowthDeliverabilityDashboard />
}

export function WorkspaceSettingsGrowthEngineDnsVerificationSection() {
  useEffect(() => {
    console.info("[dns-verification-mount]")

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
      data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_DNS_VERIFICATION_SECTION_QA_MARKER}
      data-workspace-settings-growth-engine-dns-verification-section="v1"
    >
      <DnsVerificationPanelErrorBoundary onRetry={() => setRetryKey((key) => key + 1)}>
        <DnsVerificationDashboardRender key={retryKey} />
      </DnsVerificationPanelErrorBoundary>
    </div>
  )
}
