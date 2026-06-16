"use client"

import { GROWTH_AUTOMATION_NODE_TYPES, type GrowthAutomationNodeType } from "@/lib/growth/automation/growth-automation-types"
import { Button } from "@/components/ui/button"

type Props = {
  disabled?: boolean
  onAddNode?: (nodeType: GrowthAutomationNodeType) => void
}

const NODE_LABELS: Record<GrowthAutomationNodeType, string> = {
  trigger: "Trigger",
  condition: "Condition",
  wait: "Wait",
  branch: "Branch",
  action: "Action",
  approval: "Approval",
  exit: "Exit",
}

export function GrowthAutomationNodePalette({ disabled, onAddNode }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">Node palette</h3>
      <p className="mt-1 text-xs text-muted-foreground">Click to add nodes to the draft version.</p>
      <div className="mt-3 grid gap-2">
        {GROWTH_AUTOMATION_NODE_TYPES.map((nodeType) => (
          <Button
            key={nodeType}
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={disabled}
            onClick={() => onAddNode?.(nodeType)}
          >
            {NODE_LABELS[nodeType]}
          </Button>
        ))}
      </div>
    </div>
  )
}
