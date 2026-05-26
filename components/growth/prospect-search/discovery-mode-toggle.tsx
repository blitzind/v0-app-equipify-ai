"use client"

import { Building2, Globe } from "lucide-react"
import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function DiscoveryModeToggle({
  mode,
  onChange,
}: {
  mode: GrowthProspectSearchDiscoveryMode
  onChange: (mode: GrowthProspectSearchDiscoveryMode) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "internal"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("internal")}
      >
        <Building2 className="size-3.5" />
        Search internal
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "discover_external"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("discover_external")}
      >
        <Globe className="size-3.5" />
        Discover new companies
      </button>
    </div>
  )
}
