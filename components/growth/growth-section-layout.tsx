"use client"

import type { ReactNode } from "react"
import { GrowthSectionSidebarNav } from "@/components/growth/growth-section-sidebar-nav"

type GrowthSectionLayoutProps = {
  children: ReactNode
}

/** Two-column Growth module layout: sidebar nav + main content. Place page hero above this wrapper. */
export function GrowthSectionLayout({ children }: GrowthSectionLayoutProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <GrowthSectionSidebarNav />
      <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
    </div>
  )
}
