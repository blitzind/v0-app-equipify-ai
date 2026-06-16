"use client"

import { Button } from "@/components/ui/button"
import { GROWTH_AUTOMATION_CANVAS_EDGE_TYPES } from "@/lib/growth/automation/growth-automation-canvas-types"

type Props = {
  selectedEdgeType?: string
  disabled?: boolean
  onSelectEdgeType?: (edgeType: (typeof GROWTH_AUTOMATION_CANVAS_EDGE_TYPES)[number]) => void
}

export function GrowthAutomationEdgeToolbar({ selectedEdgeType, disabled, onSelectEdgeType }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {GROWTH_AUTOMATION_CANVAS_EDGE_TYPES.map((edgeType) => (
        <Button
          key={edgeType}
          size="sm"
          variant={selectedEdgeType === edgeType ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onSelectEdgeType?.(edgeType)}
        >
          {edgeType}
        </Button>
      ))}
    </div>
  )
}
