/** Growth Engine S5-C — canvas helpers (client-safe). */

import {
  GROWTH_AUTOMATION_CANVAS_EDGE_TYPES,
  GROWTH_AUTOMATION_CANVAS_NODE_TYPES,
  type AutomationCanvasEdge,
  type AutomationCanvasNode,
  type GrowthAutomationCanvasEdgeType,
  type GrowthAutomationCanvasNodeType,
} from "@/lib/growth/automation/growth-automation-canvas-types"

export function isCanvasNodeType(value: string): value is GrowthAutomationCanvasNodeType {
  return (GROWTH_AUTOMATION_CANVAS_NODE_TYPES as readonly string[]).includes(value)
}

export function isCanvasEdgeType(value: string): value is GrowthAutomationCanvasEdgeType {
  return (GROWTH_AUTOMATION_CANVAS_EDGE_TYPES as readonly string[]).includes(value)
}

export function defaultConfigForCanvasNodeType(nodeType: GrowthAutomationCanvasNodeType): Record<string, unknown> {
  switch (nodeType) {
    case "trigger":
      return { triggerSource: "lead.created" }
    case "action":
      return { actionType: "assign_operator" }
    case "goal":
      return { goalType: "conversion" }
    default:
      return {}
  }
}

export function defaultLabelForCanvasNodeType(nodeType: GrowthAutomationCanvasNodeType): string {
  const labels: Record<GrowthAutomationCanvasNodeType, string> = {
    trigger: "Trigger",
    condition: "Condition",
    wait: "Wait",
    approval: "Approval",
    action: "Action",
    goal: "Goal",
    exit: "Exit",
  }
  return labels[nodeType]
}

export function createCanvasNode(input: {
  id: string
  nodeType: GrowthAutomationCanvasNodeType
  position: { x: number; y: number }
  label?: string
  description?: string
  config?: Record<string, unknown>
  persistenceNodeId?: string
}): AutomationCanvasNode {
  return {
    id: input.id,
    type: "automation",
    position: input.position,
    data: {
      label: input.label ?? defaultLabelForCanvasNodeType(input.nodeType),
      description: input.description ?? "",
      config: input.config ?? defaultConfigForCanvasNodeType(input.nodeType),
      validation: "pending",
      validationMessages: [],
      disabled: false,
      canvasNodeType: input.nodeType,
      persistenceNodeId: input.persistenceNodeId,
    },
  }
}

export function createCanvasEdge(input: {
  id: string
  source: string
  target: string
  edgeType?: GrowthAutomationCanvasEdgeType
  label?: string
  animated?: boolean
  persistenceEdgeId?: string
}): AutomationCanvasEdge {
  const edgeType = input.edgeType ?? "default"
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    type: "automation",
    animated: input.animated ?? edgeType === "timeout",
    label: input.label,
    data: {
      label: input.label ?? edgeType,
      canvasEdgeType: edgeType,
      persistenceEdgeId: input.persistenceEdgeId,
    },
  }
}

export function filterCanvasNodesBySearch(nodes: AutomationCanvasNode[], query: string): AutomationCanvasNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return nodes
  return nodes.filter((node) => {
    const haystack = [
      node.data.label,
      node.data.description,
      node.data.canvasNodeType,
      JSON.stringify(node.data.config),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(needle)
  })
}

function canvasNodeCompareKey(node: AutomationCanvasNode): string {
  return JSON.stringify({
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width,
    height: node.height,
    data: node.data,
  })
}

function canvasEdgeCompareKey(edge: AutomationCanvasEdge): string {
  return JSON.stringify({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: edge.label,
    animated: edge.animated,
    data: edge.data,
  })
}

export function canvasSnapshotsEqual(
  left: { nodes: AutomationCanvasNode[]; edges: AutomationCanvasEdge[] },
  right: { nodes: AutomationCanvasNode[]; edges: AutomationCanvasEdge[] },
): boolean {
  if (left.nodes.length !== right.nodes.length || left.edges.length !== right.edges.length) return false

  const leftNodes = [...left.nodes].sort((a, b) => a.id.localeCompare(b.id))
  const rightNodes = [...right.nodes].sort((a, b) => a.id.localeCompare(b.id))
  for (let index = 0; index < leftNodes.length; index += 1) {
    if (canvasNodeCompareKey(leftNodes[index]!) !== canvasNodeCompareKey(rightNodes[index]!)) return false
  }

  const leftEdges = [...left.edges].sort((a, b) => a.id.localeCompare(b.id))
  const rightEdges = [...right.edges].sort((a, b) => a.id.localeCompare(b.id))
  for (let index = 0; index < leftEdges.length; index += 1) {
    if (canvasEdgeCompareKey(leftEdges[index]!) !== canvasEdgeCompareKey(rightEdges[index]!)) return false
  }

  return true
}

export function sameSelectedNodeIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

export function cloneCanvasState<T extends { nodes: AutomationCanvasNode[]; edges: AutomationCanvasEdge[] }>(
  state: T,
): T {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: { ...node.data, config: { ...node.data.config }, validationMessages: [...node.data.validationMessages] },
    })),
    edges: state.edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : edge.data,
    })),
  }
}
