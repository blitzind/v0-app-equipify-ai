"use client"

import { MiniMap } from "reactflow"

export function GrowthAutomationMiniMap() {
  return (
    <MiniMap
      pannable
      zoomable
      nodeStrokeWidth={3}
      nodeColor={(node) => {
        switch (node.data?.canvasNodeType) {
          case "trigger":
            return "#8b5cf6"
          case "exit":
          case "goal":
            return "#64748b"
          case "action":
            return "#10b981"
          default:
            return "#0ea5e9"
        }
      }}
    />
  )
}
