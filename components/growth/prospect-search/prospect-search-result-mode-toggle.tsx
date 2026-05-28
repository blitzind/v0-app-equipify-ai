"use client"

import { cn } from "@/lib/utils"
import {
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  GROWTH_PEOPLE_FIRST_GRID_QA_MARKER,
  type ProspectSearchResultMode,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-native-index"

const MODES: Array<{ id: ProspectSearchResultMode; label: string }> = [
  { id: "people", label: "People" },
  { id: "companies", label: "Companies" },
  { id: "territory", label: "Territory" },
  { id: "queue", label: "Queue" },
]

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
      data-contact-native-search-marker={GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER}
      data-people-first-grid-marker={GROWTH_PEOPLE_FIRST_GRID_QA_MARKER}
      data-contact-discovery-mode={mode}
      role="group"
      aria-label="Prospect search result mode"
    >
      {MODES.map((entry) => {
        const count =
          entry.id === "people" || entry.id === "queue"
            ? peopleCount
            : entry.id === "companies"
              ? companyCount
              : companyCount
        return (
          <button
            key={entry.id}
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === entry.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={mode === entry.id}
            onClick={() => onModeChange(entry.id)}
          >
            {entry.label} ({count})
          </button>
        )
      })}
    </div>
  )
}
