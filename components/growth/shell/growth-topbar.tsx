"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/admin-store"
import { initialsFromDisplayLabel } from "@/lib/user-display"
import { GROWTH_BRAND } from "@/components/growth/shell/growth-brand"
import { GrowthModuleSwitcher } from "@/components/growth/shell/growth-module-switcher"

type GrowthTopbarProps = {
  onOpenMobileNav?: () => void
}

export function GrowthTopbar({ onOpenMobileNav }: GrowthTopbarProps) {
  const { sessionIdentity } = useAdmin()
  const displayName = sessionIdentity?.displayName?.trim() ?? ""
  const email = sessionIdentity?.email?.trim() ?? ""
  const line1 = displayName || email || "Operator"
  const line2 =
    displayName && email && displayName.toLowerCase() !== email.toLowerCase()
      ? email
      : (sessionIdentity?.platformRoleLabel ?? "Platform Admin")
  const initials = initialsFromDisplayLabel(displayName || email || "?")

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 md:hidden"
        onClick={onOpenMobileNav}
        aria-label={`Open ${GROWTH_BRAND.name} navigation menu`}
      >
        <Menu className="size-5" />
      </Button>
      <GrowthModuleSwitcher compact />
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold leading-tight">{line1}</p>
          <p className="text-[10px] text-muted-foreground">{line2}</p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-[11px] font-bold text-white">
          {initials}
        </div>
      </div>
    </header>
  )
}
