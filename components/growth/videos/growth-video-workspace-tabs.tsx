"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  GROWTH_VIDEO_WORKSPACE_NAV_QA_MARKER,
  GROWTH_VIDEO_WORKSPACE_TABS,
  resolveGrowthVideoActiveTabId,
} from "@/lib/growth/navigation/growth-video-workspace-navigation"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export function GrowthVideoWorkspaceTabs() {
  const pathname = usePathname()
  const activeId = resolveGrowthVideoActiveTabId(pathname)

  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label="Video workspace"
      data-qa-marker={GROWTH_VIDEO_WORKSPACE_NAV_QA_MARKER}
    >
      {GROWTH_VIDEO_WORKSPACE_TABS.map((tab) => {
        const segment = tab.href.replace(`${GROWTH_WORKSPACE_BASE_PATH}/`, "")
        const href = growthFeaturePath(pathname, segment)
        const isActive = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
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
