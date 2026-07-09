"use client"

import { usePathname } from "next/navigation"
import { AidenAskLauncher } from "@/components/growth/aiden-ask-launcher"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

function isGrowthHomePathname(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === GROWTH_WORKSPACE_BASE_PATH || pathname === `${GROWTH_WORKSPACE_BASE_PATH}/`
}

/**
 * GE-AIOS-17F — Hide Aiden coach bubble on AI OS Home to avoid identity conflict with Ava.
 * Aiden remains available on other Growth workspace routes and admin surfaces.
 */
export function GrowthAidenAskLauncherGate() {
  const pathname = usePathname()
  if (isGrowthHomePathname(pathname)) return null
  return <AidenAskLauncher />
}
