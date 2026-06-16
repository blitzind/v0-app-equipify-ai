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
