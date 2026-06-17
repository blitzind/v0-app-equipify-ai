"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthAutomationCanvasNodeType } from "@/lib/growth/automation/growth-automation-canvas-types"
import { defaultLabelForCanvasNodeType } from "@/lib/growth/automation/growth-automation-canvas-utils"

type Props = {
  disabled?: boolean
  onAddNode?: (nodeType: GrowthAutomationCanvasNodeType) => void
}

const NODE_GROUPS: Array<{ title: string; nodeTypes: GrowthAutomationCanvasNodeType[]; defaultOpen?: boolean }> = [
  { title: "Triggers", nodeTypes: ["trigger"], defaultOpen: true },
  { title: "Logic", nodeTypes: ["condition", "wait", "approval"], defaultOpen: true },
  { title: "Actions", nodeTypes: ["action"], defaultOpen: false },
  { title: "Goals", nodeTypes: ["goal", "exit"], defaultOpen: false },
]

function NodeGroup({
  title,
  nodeTypes,
  defaultOpen = false,
  disabled,
  onAddNode,
}: {
  title: string
  nodeTypes: GrowthAutomationCanvasNodeType[]
  defaultOpen?: boolean
  disabled?: boolean
  onAddNode?: (nodeType: GrowthAutomationCanvasNodeType) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border/70">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        {title}
      </button>
      {open ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/70 p-2">
          {nodeTypes.map((nodeType) => (
            <Button
              key={nodeType}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={disabled}
              onClick={() => onAddNode?.(nodeType)}
            >
              {defaultLabelForCanvasNodeType(nodeType)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function GrowthAutomationNodeCreationMenu({ disabled, onAddNode }: Props) {
  return (
    <div className="space-y-2">
      {NODE_GROUPS.map((group) => (
        <NodeGroup
          key={group.title}
          title={group.title}
          nodeTypes={group.nodeTypes}
          defaultOpen={group.defaultOpen}
          disabled={disabled}
          onAddNode={onAddNode}
        />
      ))}
    </div>
  )
}
