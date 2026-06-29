"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAdmin } from "@/lib/admin-store"

export const WORKSPACE_SETTINGS_SHELL_INSTRUMENTATION_QA_MARKER =
  "workspace-settings-shell-instrumentation-v1" as const

/** Dev/prod hotfix trace — logs settings shell lifecycle on growth-engine routes. */
export function WorkspaceSettingsShellInstrumentation() {
  const pathname = usePathname() ?? ""
  const { isPlatformAdmin, sessionIdentityLoading } = useAdmin()

  useEffect(() => {
    if (!pathname.startsWith("/settings/growth-engine")) return
    console.info("[growth-settings-shell]", {
      event: "settings_shell_mounted",
      pathname,
      isPlatformAdmin,
      sessionIdentityLoading,
      marker: WORKSPACE_SETTINGS_SHELL_INSTRUMENTATION_QA_MARKER,
    })
  }, [pathname, isPlatformAdmin, sessionIdentityLoading])

  useEffect(() => {
    if (!pathname.startsWith("/settings/growth-engine")) return
    if (sessionIdentityLoading) return
    console.info("[growth-settings-shell]", {
      event: "settings_shell_identity_ready",
      pathname,
      isPlatformAdmin,
      marker: WORKSPACE_SETTINGS_SHELL_INSTRUMENTATION_QA_MARKER,
    })
  }, [pathname, isPlatformAdmin, sessionIdentityLoading])

  return (
    <span
      hidden
      data-qa-marker={WORKSPACE_SETTINGS_SHELL_INSTRUMENTATION_QA_MARKER}
      data-workspace-settings-shell-instrumentation="v1"
    />
  )
}
