"use client"

import { usePathname } from "next/navigation"
import { useAdmin } from "@/lib/admin-store"
import { isGrowthEngineSettingsNavVisible } from "@/lib/settings/workspace-settings-visibility"
import { WorkspaceSettingsNav } from "@/components/settings/workspace-settings-nav"
import { WorkspaceSettingsNavErrorBoundary } from "@/components/settings/workspace-settings-nav-error-boundary"

type WorkspaceSettingsNavShellProps = {
  variant: "mobile" | "desktop"
}

export function WorkspaceSettingsNavShell({ variant }: WorkspaceSettingsNavShellProps) {
  const pathname = usePathname() ?? ""
  const { isPlatformAdmin } = useAdmin()
  const growthCategoryLoaded = isGrowthEngineSettingsNavVisible({ isPlatformAdmin })

  return (
    <WorkspaceSettingsNavErrorBoundary
      variant={variant}
      pathname={pathname}
      isPlatformAdmin={isPlatformAdmin}
      growthCategoryLoaded={growthCategoryLoaded}
    >
      <WorkspaceSettingsNav variant={variant} />
    </WorkspaceSettingsNavErrorBoundary>
  )
}
