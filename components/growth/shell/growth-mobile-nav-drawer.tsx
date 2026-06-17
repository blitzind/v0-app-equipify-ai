"use client"

import { X } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { GROWTH_BRAND, GROWTH_WORKSPACE_SHELL_MOBILE_QA_MARKER } from "@/components/growth/shell/growth-brand"
import { GrowthSidebarNavContent } from "@/components/growth/shell/growth-sidebar-nav-content"
import { GROWTH_SHELL_NAV_QA_MARKER } from "@/components/growth/shell/growth-shell-navigation"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type GrowthMobileNavDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrowthMobileNavDrawer({ open, onOpenChange }: GrowthMobileNavDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[min(85vw,280px)] flex-col border-r border-white/10 bg-[#0F172A] p-0 text-white"
        data-qa-marker={GROWTH_WORKSPACE_SHELL_MOBILE_QA_MARKER}
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{GROWTH_BRAND.name} navigation</SheetTitle>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo className="h-7 w-auto max-h-7" priority />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{GROWTH_BRAND.name}</p>
              <p className="truncate text-[10px] uppercase tracking-widest text-slate-400">
                {GROWTH_BRAND.workspaceLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <div data-qa-marker={GROWTH_SHELL_NAV_QA_MARKER} className="flex min-h-0 flex-1 flex-col">
          <GrowthSidebarNavContent onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
