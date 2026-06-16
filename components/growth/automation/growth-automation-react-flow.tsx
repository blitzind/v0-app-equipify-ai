"use client"

import { useCallback, useMemo } from "react"
import ReactFlow, {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "reactflow"
import "reactflow/dist/style.css"
import { GrowthAutomationBackground } from "@/components/growth/automation/growth-automation-background"
import { GrowthAutomationControls } from "@/components/growth/automation/growth-automation-controls"
import { GrowthAutomationEdge } from "@/components/growth/automation/growth-automation-edge"
import { GrowthAutomationEmptyState } from "@/components/growth/automation/growth-automation-empty-state"
import { GrowthAutomationMiniMap } from "@/components/growth/automation/growth-automation-mini-map"
import { GrowthAutomationNode } from "@/components/growth/automation/growth-automation-node"
import type {
  AutomationCanvasEdge,
  AutomationCanvasNode,
  GrowthAutomationCanvasEdgeType,
} from "@/lib/growth/automation/growth-automation-canvas-types"
import { createCanvasEdge } from "@/lib/growth/automation/growth-automation-canvas-utils"

const nodeTypes = { automation: GrowthAutomationNode }
const edgeTypes = { automation: GrowthAutomationEdge }

type Props = {
  nodes: AutomationCanvasNode[]
  edges: AutomationCanvasEdge[]
  readOnly?: boolean
  defaultEdgeType?: GrowthAutomationCanvasEdgeType
  onNodesChange?: (nodes: AutomationCanvasNode[]) => void
  onEdgesChange?: (edges: AutomationCanvasEdge[]) => void
  onSelectionChange?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void
  onInit?: (instance: ReactFlowInstance) => void
}

export function GrowthAutomationReactFlow({
  nodes,
  edges,
  readOnly = false,
  defaultEdgeType = "default",
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  onInit,
}: Props) {
  const proOptions = useMemo(() => ({ hideAttribution: true }), [])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return
      onNodesChange?.(applyNodeChanges(changes, nodes) as AutomationCanvasNode[])
    },
    [nodes, onNodesChange, readOnly],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return
      onEdgesChange?.(applyEdgeChanges(changes, edges) as AutomationCanvasEdge[])
    },
    [edges, onEdgesChange, readOnly],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return
      onEdgesChange?.([
        ...edges,
        createCanvasEdge({
          id: crypto.randomUUID(),
          source: connection.source,
          target: connection.target,
          edgeType: defaultEdgeType,
        }),
      ])
    },
    [defaultEdgeType, edges, onEdgesChange, readOnly],
  )

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      onSelectionChange?.({
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id),
      })
    },
    [onSelectionChange],
  )

  return (
    <div className="h-[560px] w-full rounded-xl border border-border bg-muted/10">
      {nodes.length === 0 ? (
        <GrowthAutomationEmptyState />
      ) : (
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onSelectionChange={handleSelectionChange}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          proOptions={proOptions}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <GrowthAutomationBackground />
          <GrowthAutomationControls />
          <GrowthAutomationMiniMap />
        </ReactFlow>
      )}
    </div>
  )
}
