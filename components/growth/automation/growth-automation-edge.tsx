"use client"

import { memo } from "react"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "reactflow"
import type { GrowthAutomationCanvasEdgeData } from "@/lib/growth/automation/growth-automation-canvas-types"

const EDGE_COLORS: Record<string, string> = {
  default: "#64748b",
  success: "#16a34a",
  failure: "#dc2626",
  yes: "#16a34a",
  no: "#dc2626",
  timeout: "#f59e0b",
}

function GrowthAutomationEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<GrowthAutomationCanvasEdgeData>) {
  const edgeType = data?.canvasEdgeType ?? "default"
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: EDGE_COLORS[edgeType] ?? EDGE_COLORS.default,
          strokeWidth: selected ? 2.5 : 1.75,
        }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const GrowthAutomationEdge = memo(GrowthAutomationEdgeComponent)
