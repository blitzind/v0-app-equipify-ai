"use client"

import { Globe, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function IntentSignalsFilterBar({
  filters,
  sourceLabel = "Global",
  sourceDisabled = false,
  className,
}: {
  filters: readonly string[]
  sourceLabel?: string
  sourceDisabled?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-normal"
          >
            {filter === "More filters" ? (
              <>
                <SlidersHorizontal className="mr-1.5 size-3.5" />
                {filter}
              </>
            ) : (
              filter
            )}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sourceDisabled}
        className="h-8 shrink-0 gap-1.5 self-start sm:self-auto"
        title={sourceDisabled ? "Source scope coming soon for preview tabs" : "Signal source scope"}
      >
        <Globe className="size-3.5" />
        Source: {sourceLabel}
      </Button>
    </div>
  )
}
