"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export const DASHBOARD_SHELL_GROWTH_SETTINGS_INSTRUMENTATION_QA_MARKER =
  "dashboard-shell-growth-settings-instrumentation-v1" as const

/** Logs dashboard shell mount when the active route is growth-engine settings. */
export function DashboardGrowthSettingsShellInstrumentation() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    if (!pathname.startsWith("/settings/growth-engine")) return
    console.info("[growth-settings-shell]", {
      event: "dashboard_shell_mounted",
      pathname,
      marker: DASHBOARD_SHELL_GROWTH_SETTINGS_INSTRUMENTATION_QA_MARKER,
    })
  }, [pathname])

  return (
    <span
      hidden
      data-qa-marker={DASHBOARD_SHELL_GROWTH_SETTINGS_INSTRUMENTATION_QA_MARKER}
      data-dashboard-growth-settings-shell-instrumentation="v1"
    />
  )
}
