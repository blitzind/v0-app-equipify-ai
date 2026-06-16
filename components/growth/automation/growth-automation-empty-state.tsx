"use client"

import { GitBranch } from "lucide-react"

export function GrowthAutomationEmptyState() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <GitBranch size={20} />
      </span>
      <p className="text-sm font-medium">Start your automation flow</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Drag nodes from the palette or use the creation menu. Connect nodes to define branches and exits.
      </p>
    </div>
  )
}
