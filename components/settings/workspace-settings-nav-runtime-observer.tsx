"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export const WORKSPACE_SETTINGS_NAV_RUNTIME_OBSERVER_QA_MARKER =
  "workspace-settings-nav-runtime-observer-v1" as const

const LOG_PREFIX = "[workspace-settings-nav-runtime]"

/** Temporary window error hooks for WorkspaceSettingsNav post-mount failures. */
export function WorkspaceSettingsNavRuntimeObserver() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    if (!pathname.startsWith("/settings/growth-engine")) return

    function onError(event: ErrorEvent) {
      const err = event.error
      console.error(LOG_PREFIX, {
        kind: "error",
        message: err instanceof Error ? err.message : event.message,
        stack: err instanceof Error ? err.stack : undefined,
        pathname,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      console.error(LOG_PREFIX, {
        kind: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        pathname,
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [pathname])

  return (
    <span
      hidden
      data-qa-marker={WORKSPACE_SETTINGS_NAV_RUNTIME_OBSERVER_QA_MARKER}
      data-workspace-settings-nav-runtime-observer="v1"
    />
  )
}
