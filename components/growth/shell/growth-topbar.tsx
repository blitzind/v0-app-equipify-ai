"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { WORKSPACE_SHELL_TOPBAR } from "@/lib/workspace/workspace-shell-tokens"
import { WorkspaceSearch } from "@/components/workspace/workspace-search"
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher"
import { WorkspaceTopbarAccountControls } from "@/components/workspace/workspace-topbar-account-controls"

type GrowthTopbarProps = {
  mobileNavOpen?: boolean
  onOpenMobileNav?: () => void
}

export function GrowthTopbar({ mobileNavOpen = false, onOpenMobileNav }: GrowthTopbarProps) {
  return (
    <header className={WORKSPACE_SHELL_TOPBAR}>
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-md hover:bg-sidebar-accent/60 transition-colors shrink-0 touch-manipulation"
        aria-label="Open menu"
        aria-expanded={mobileNavOpen}
        aria-controls="mobile-sidebar-nav"
      >
        <Menu className="w-5 h-5 text-sidebar-foreground" />
      </button>

      <Link
        href="/growth"
        className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none cursor-pointer"
        aria-label="Equipify — Growth Engine"
      >
        <BrandLogo className="h-7 w-auto max-h-7" priority />
      </Link>

      <WorkspaceSwitcher compact className="hidden sm:flex shrink-0" />

      <WorkspaceSearch workspace="growth" />

      <WorkspaceTopbarAccountControls />
    </header>
  )
}
