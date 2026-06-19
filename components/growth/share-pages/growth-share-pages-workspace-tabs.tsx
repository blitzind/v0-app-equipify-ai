"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GROWTH_SHARE_PAGES_WORKSPACE_NAV_QA_MARKER,
  GROWTH_SHARE_PAGES_WORKSPACE_TABS,
  resolveGrowthSharePagesActiveTabId,
} from "@/lib/growth/navigation/growth-share-pages-workspace-navigation"
import { growthFeaturePath, GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

export function GrowthSharePagesWorkspaceTabs() {
  const pathname = usePathname()
  const activeId = resolveGrowthSharePagesActiveTabId(pathname)

  return (
    <nav
      className="mb-4 flex flex-wrap gap-2"
      aria-label="Share pages workspace"
      data-qa-marker={GROWTH_SHARE_PAGES_WORKSPACE_NAV_QA_MARKER}
    >
      {GROWTH_SHARE_PAGES_WORKSPACE_TABS.map((tab) => {
        const segment = tab.href.replace(`${GROWTH_WORKSPACE_BASE_PATH}/`, "")
        const href = growthFeaturePath(pathname, segment)
        const isActive = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
