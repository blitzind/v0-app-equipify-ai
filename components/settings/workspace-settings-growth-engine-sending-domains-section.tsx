"use client"

import { useEffect } from "react"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import { GrowthSenderInfrastructureDashboard } from "@/components/growth/growth-sender-infrastructure-dashboard"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDING_DOMAINS_SECTION_QA_MARKER =
  "workspace-settings-growth-engine-sending-domains-section-v1" as const

const RUNTIME_LOG_PREFIX = "[sending-domains-runtime]"
const PANEL_ERROR_BOUNDARY_MARKER =
  "workspace-settings-growth-engine-sending-domains-panel-error-boundary-v1" as const

function SendingDomainsDashboardRender() {
  console.info("[sending-domains-render]")

  return <GrowthSenderInfrastructureDashboard />
}

export function WorkspaceSettingsGrowthEngineSendingDomainsSection() {
  useEffect(() => {
    console.info("[sending-domains-mount]")

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

  return (
    <div
      data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_SENDING_DOMAINS_SECTION_QA_MARKER}
      data-workspace-settings-growth-engine-sending-domains-section="v1"
    >
      <GrowthAdminWidgetErrorBoundary
        label="Sending domains"
        qaMarker={PANEL_ERROR_BOUNDARY_MARKER}
      >
        <SendingDomainsDashboardRender />
      </GrowthAdminWidgetErrorBoundary>
    </div>
  )
}
