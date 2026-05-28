"use client"

import type { ReactNode } from "react"
import { GrowthSectionSidebarNav } from "@/components/growth/growth-section-sidebar-nav"
import { GrowthOperatorAttentionStrip } from "@/components/growth/growth-operator-attention-strip"
import { GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"

type GrowthSectionLayoutProps = {
  children: ReactNode
}

/** Two-column Growth module layout: sidebar nav + main content. Place page hero above this wrapper. */
export function GrowthSectionLayout({ children }: GrowthSectionLayoutProps) {
  return (
    <div
      className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6"
      data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}
    >
      <GrowthSectionSidebarNav />
      <div className="flex min-w-0 flex-1 flex-col gap-4" data-attention-quiet-qa="growth-attention-quiet-healthy-v1">
        <GrowthOperatorAttentionStrip compact />
        {children}
      </div>
    </div>
  )
}
