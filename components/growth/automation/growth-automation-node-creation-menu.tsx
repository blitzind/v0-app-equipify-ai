"use client"

import { Button } from "@/components/ui/button"
import type { GrowthAutomationCanvasNodeType } from "@/lib/growth/automation/growth-automation-canvas-types"
import { GROWTH_AUTOMATION_CANVAS_NODE_TYPES } from "@/lib/growth/automation/growth-automation-canvas-types"
import { defaultLabelForCanvasNodeType } from "@/lib/growth/automation/growth-automation-canvas-utils"

type Props = {
  disabled?: boolean
  onAddNode?: (nodeType: GrowthAutomationCanvasNodeType) => void
}

export function GrowthAutomationNodeCreationMenu({ disabled, onAddNode }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {GROWTH_AUTOMATION_CANVAS_NODE_TYPES.map((nodeType) => (
        <Button
          key={nodeType}
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onAddNode?.(nodeType)}
        >
          {defaultLabelForCanvasNodeType(nodeType)}
        </Button>
      ))}
    </div>
  )
}
