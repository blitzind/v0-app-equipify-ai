"use client"

import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  view: "table" | "card"
  onViewChange: (v: "table" | "card") => void
  className?: string
}

/**
 * Compact segmented icon toggle — Grid (card) and List (table).
 * Matches the Technicians page reference style: pill container, solid Equipify
 * blue for the active state, neutral background otherwise.
 */
export function ViewToggle({ view, onViewChange, className }: ViewToggleProps) {
  return (
    <div className={cn("flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-background shrink-0", className)}>
      <button
        onClick={() => onViewChange("table")}
        aria-label="List view"
        className={cn(
          "p-1.5 rounded transition-colors cursor-pointer",
          view === "table"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => onViewChange("card")}
        aria-label="Grid view"
        className={cn(
          "p-1.5 rounded transition-colors cursor-pointer",
          view === "card"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )
}
