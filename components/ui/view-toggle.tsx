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
          "p-1.5 rounded border border-transparent transition-all duration-150 cursor-pointer",
          view === "table"
            ? "bg-primary text-primary-foreground border-primary shadow-sm dark:bg-[#13233F] dark:text-[#6EA8FF] dark:border-[#296cff]/30 dark:shadow-[0_0_18px_-6px_rgba(41,108,255,0.45)]"
            : "text-muted-foreground hover:text-foreground dark:hover:bg-[#13233F]/25",
        )}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => onViewChange("card")}
        aria-label="Grid view"
        className={cn(
          "p-1.5 rounded border border-transparent transition-all duration-150 cursor-pointer",
          view === "card"
            ? "bg-primary text-primary-foreground border-primary shadow-sm dark:bg-[#13233F] dark:text-[#6EA8FF] dark:border-[#296cff]/30 dark:shadow-[0_0_18px_-6px_rgba(41,108,255,0.45)]"
            : "text-muted-foreground hover:text-foreground dark:hover:bg-[#13233F]/25",
        )}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )
}
