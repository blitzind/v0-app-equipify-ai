"use client"

import { useContext } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { SidebarContext } from "@/components/app-sidebar"
import { BrandLogo } from "@/components/brand-logo"
import { GlobalSearchHeader } from "@/components/global-search-header"
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher"
import { WorkspaceTopbarAccountControls } from "@/components/workspace/workspace-topbar-account-controls"
import { useActiveOrganizationOptional } from "@/lib/active-organization-context"
import { WORKSPACE_SHELL_TOPBAR } from "@/lib/workspace/workspace-shell-tokens"

export function AppTopbar() {
  const activeOrgOpt = useActiveOrganizationOptional()
  const { mobileOpen, setMobileOpen } = useContext(SidebarContext)

  return (
    <header className={WORKSPACE_SHELL_TOPBAR}>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-md hover:bg-sidebar-accent/60 transition-colors shrink-0 touch-manipulation"
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar-nav"
      >
        <Menu className="w-5 h-5 text-sidebar-foreground" />
      </button>

      <Link
        href="/"
        className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none cursor-pointer"
        aria-label="Equipify — Home"
      >
        <BrandLogo className="h-7 w-auto max-h-7" priority />
      </Link>

      <WorkspaceSwitcher compact className="hidden sm:flex shrink-0" />

      <GlobalSearchHeader
        organizationId={activeOrgOpt?.organizationId ?? null}
        orgReady={activeOrgOpt?.status === "ready"}
      />

      <WorkspaceTopbarAccountControls />
    </header>
  )
}
