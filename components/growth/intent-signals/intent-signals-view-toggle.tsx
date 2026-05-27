"use client"

import { Building2, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type IntentSignalsViewMode = "company" | "people"

export function IntentSignalsViewToggle({
  mode,
  onChange,
}: {
  mode: IntentSignalsViewMode
  onChange: (mode: IntentSignalsViewMode) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "company"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("company")}
      >
        <Building2 className="size-3.5" />
        Company
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "people"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("people")}
      >
        <User className="size-3.5" />
        People
      </button>
    </div>
  )
}
