"use client"

import { LayoutGrid, Redo2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthAutomationCanvasLayoutMode } from "@/lib/growth/automation/growth-automation-canvas-types"

type Props = {
  disabled?: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onAutoLayout?: (mode: GrowthAutomationCanvasLayoutMode) => void
}

export function GrowthAutomationNodeToolbar({
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={disabled || !canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
        Undo
      </Button>
      <Button size="sm" variant="outline" disabled={disabled || !canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
        Redo
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAutoLayout?.("top_to_bottom")}>
        <LayoutGrid className="size-4" />
        Auto layout
      </Button>
    </div>
  )
}
