"use client"

import type { GrowthAutomationEdge, GrowthAutomationNode } from "@/lib/growth/automation/growth-automation-types"

type Props = {
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
}

export function GrowthAutomationCanvas({ nodes, edges, selectedNodeId, onSelectNode }: Props) {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-dashed border-border bg-muted/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:20px_20px]" />
      <div className="relative p-4">
        <p className="mb-4 text-xs text-muted-foreground">
          Canvas scaffolding only — no drag/drop or React Flow in S5-B.
        </p>
        {nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add nodes from the palette to begin.</p>
        ) : (
          <div className="relative min-h-[320px]">
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {edges.map((edge) => {
                const from = nodes.find((node) => node.id === edge.fromNodeId)
                const to = nodes.find((node) => node.id === edge.toNodeId)
                if (!from || !to) return null
                return (
                  <line
                    key={edge.id}
                    x1={from.positionX + 80}
                    y1={from.positionY + 24}
                    x2={to.positionX}
                    y2={to.positionY + 24}
                    stroke="currentColor"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                  />
                )
              })}
            </svg>
            {nodes.map((node) => {
              const selected = selectedNodeId === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`absolute w-40 rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition ${
                    selected ? "border-sky-500 bg-sky-50" : "border-border bg-card hover:border-sky-300"
                  }`}
                  style={{ left: node.positionX, top: node.positionY }}
                  onClick={() => onSelectNode?.(node.id)}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    {node.nodeType}
                  </span>
                  <span className="font-medium">{node.label || "Untitled"}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
