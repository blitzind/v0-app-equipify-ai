"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { useAdmin } from "@/lib/admin-store"
import { initialsFromDisplayLabel } from "@/lib/user-display"
import { WORKSPACE_SHELL_TOPBAR } from "@/lib/workspace/workspace-shell-tokens"
import { WorkspaceSearch } from "@/components/workspace/workspace-search"
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher"
import { cn } from "@/lib/utils"

type GrowthTopbarProps = {
  mobileNavOpen?: boolean
  onOpenMobileNav?: () => void
}

export function GrowthTopbar({ mobileNavOpen = false, onOpenMobileNav }: GrowthTopbarProps) {
  const { sessionIdentity } = useAdmin()
  const displayName = sessionIdentity?.displayName?.trim() ?? ""
  const email = sessionIdentity?.email?.trim() ?? ""
  const line1 = displayName || email || "Operator"
  const line2 =
    displayName && email && displayName.toLowerCase() !== email.toLowerCase()
      ? email
      : (sessionIdentity?.platformRoleLabel ?? "Member")
  const initials = initialsFromDisplayLabel(displayName || email || "?")

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

      <div className="flex items-center gap-1 ml-auto">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground leading-tight">{line1}</p>
          <p className="text-xs text-muted-foreground leading-tight">{line2}</p>
        </div>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold",
          )}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
