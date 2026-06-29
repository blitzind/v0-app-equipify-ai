"use client"

import { Suspense, useEffect } from "react"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_QA_MARKER =
  "workspace-settings-growth-engine-connected-mailboxes-section-v1" as const

const CONNECTED_MAILBOXES_OAUTH_RETURN_TO = growthEngineCustomerSettingsHref("connected-mailboxes")

const RUNTIME_LOG_PREFIX = "[connected-mailboxes-runtime]"

function ConnectedMailboxesDashboardRender() {
  console.info("[connected-mailboxes-render]")

  return <GrowthConnectedMailboxesDashboard oauthReturnTo={CONNECTED_MAILBOXES_OAUTH_RETURN_TO} />
}

function ConnectedMailboxesDashboardFallback() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
      Loading connected mailboxes…
    </div>
  )
}

export function WorkspaceSettingsGrowthEngineConnectedMailboxesSection() {
  useEffect(() => {
    console.info("[connected-mailboxes-mount]")

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
      data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_QA_MARKER}
      data-workspace-settings-growth-engine-connected-mailboxes-section="v1"
    >
      <Suspense fallback={<ConnectedMailboxesDashboardFallback />}>
        <ConnectedMailboxesDashboardRender />
      </Suspense>
    </div>
  )
}
