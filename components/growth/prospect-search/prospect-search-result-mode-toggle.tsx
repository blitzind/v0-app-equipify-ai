"use client"

import { cn } from "@/lib/utils"
import {
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  type ProspectSearchResultMode,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export function ProspectSearchResultModeToggle({
  mode,
  onModeChange,
  companyCount,
  peopleCount,
  className,
}: {
  mode: ProspectSearchResultMode
  onModeChange: (mode: ProspectSearchResultMode) => void
  companyCount: number
  peopleCount: number
  className?: string
}) {
  return (
    <div
      className={cn("inline-flex rounded-lg border border-border bg-muted/30 p-0.5", className)}
      data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
      data-contact-discovery-mode={mode}
      role="group"
      aria-label="Prospect search result mode"
    >
      <button
        type="button"
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "companies"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={mode === "companies"}
        onClick={() => onModeChange("companies")}
      >
        Companies ({companyCount})
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "people"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          peopleCount === 0 && "opacity-60",
        )}
        aria-pressed={mode === "people"}
        disabled={peopleCount === 0}
        onClick={() => onModeChange("people")}
      >
        People ({peopleCount})
      </button>
    </div>
  )
}
