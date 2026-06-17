"use client"

import { BrandLogo } from "@/components/brand-logo"
import { GROWTH_BRAND } from "@/components/growth/shell/growth-brand"
import { GrowthSidebarNavContent } from "@/components/growth/shell/growth-sidebar-nav-content"
import { GROWTH_SHELL_NAV_QA_MARKER } from "@/components/growth/shell/growth-shell-navigation"

export function GrowthSidebar() {
  return (
    <aside
      className="hidden w-[248px] shrink-0 flex-col border-r border-white/10 md:flex"
      style={{ backgroundColor: GROWTH_BRAND.sidebarBackground }}
      data-qa-marker={GROWTH_SHELL_NAV_QA_MARKER}
      aria-label={`${GROWTH_BRAND.name} navigation`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <BrandLogo className="h-7 w-auto max-h-7" priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{GROWTH_BRAND.name}</p>
          <p className="truncate text-[10px] uppercase tracking-widest text-slate-400">{GROWTH_BRAND.workspaceLabel}</p>
        </div>
      </div>
      <GrowthSidebarNavContent />
    </aside>
  )
}
