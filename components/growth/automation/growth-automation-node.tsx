"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import type { GrowthAutomationCanvasNodeData } from "@/lib/growth/automation/growth-automation-canvas-types"

const TYPE_COLORS: Record<string, string> = {
  trigger: "border-violet-400 bg-violet-50",
  condition: "border-amber-400 bg-amber-50",
  wait: "border-sky-400 bg-sky-50",
  approval: "border-orange-400 bg-orange-50",
  action: "border-emerald-400 bg-emerald-50",
  goal: "border-indigo-400 bg-indigo-50",
  exit: "border-slate-400 bg-slate-50",
}

function GrowthAutomationNodeComponent({ data, selected }: NodeProps<GrowthAutomationCanvasNodeData>) {
  const validationClass =
    data.validation === "error"
      ? "ring-2 ring-destructive"
      : data.validation === "warning"
        ? "ring-2 ring-amber-500"
        : selected
          ? "ring-2 ring-sky-500"
          : ""

  return (
    <div
      className={`min-w-[160px] rounded-lg border px-3 py-2 shadow-sm ${TYPE_COLORS[data.canvasNodeType] ?? "border-border bg-card"} ${validationClass} ${data.disabled ? "opacity-50" : ""}`}
    >
      {data.canvasNodeType !== "trigger" ? (
        <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-500" />
      ) : null}
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{data.canvasNodeType}</div>
      <div className="font-medium">{data.label || "Untitled"}</div>
      {data.description ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{data.description}</div> : null}
      {data.validationMessages.length > 0 ? (
        <div className="mt-1 text-[10px] text-destructive">{data.validationMessages[0]}</div>
      ) : null}
      {data.canvasNodeType !== "exit" && data.canvasNodeType !== "goal" ? (
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-slate-500" />
      ) : null}
    </div>
  )
}

export const GrowthAutomationNode = memo(GrowthAutomationNodeComponent)
