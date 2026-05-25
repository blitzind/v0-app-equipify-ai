"use client"

import { GROWTH_COMMAND_SECTION_TABS, scrollToGrowthCommandSection } from "@/lib/growth/command/command-center-navigation"
import { cn } from "@/lib/utils"

export function GrowthCommandSectionTabs() {
  return (
    <nav aria-label="Command center sections" className="flex gap-1 overflow-x-auto pb-1">
      {GROWTH_COMMAND_SECTION_TABS.map((tab) => (
        <button
          key={tab.anchor}
          type="button"
          onClick={() => scrollToGrowthCommandSection(tab.anchor)}
          className={cn(
            "shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground",
            "hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
