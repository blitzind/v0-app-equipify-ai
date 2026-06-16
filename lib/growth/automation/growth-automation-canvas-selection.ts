/** Growth Engine S5-C — canvas selection helpers (client-safe). */

import type { AutomationCanvasEdge, AutomationCanvasNode } from "@/lib/growth/automation/growth-automation-canvas-types"

export function getSelectedCanvasNodes(
  nodes: AutomationCanvasNode[],
  selectedNodeIds: string[],
): AutomationCanvasNode[] {
  const selected = new Set(selectedNodeIds)
  return nodes.filter((node) => node.selected || selected.has(node.id))
}

export function getSelectedCanvasEdges(
  edges: AutomationCanvasEdge[],
  selectedEdgeIds: string[],
): AutomationCanvasEdge[] {
  const selected = new Set(selectedEdgeIds)
  return edges.filter((edge) => edge.selected || selected.has(edge.id))
}

export function toggleCanvasNodeSelection(
  nodes: AutomationCanvasNode[],
  nodeId: string,
  multi = false,
): AutomationCanvasNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, selected: multi ? !node.selected : true }
    return { ...node, selected: multi ? node.selected : false }
  })
}

export function clearCanvasSelection(nodes: AutomationCanvasNode[], edges: AutomationCanvasEdge[]): {
  nodes: AutomationCanvasNode[]
  edges: AutomationCanvasEdge[]
} {
  return {
    nodes: nodes.map((node) => ({ ...node, selected: false })),
    edges: edges.map((edge) => ({ ...edge, selected: false })),
  }
}

export function removeSelectedFromCanvas(
  nodes: AutomationCanvasNode[],
  edges: AutomationCanvasEdge[],
): { nodes: AutomationCanvasNode[]; edges: AutomationCanvasEdge[] } {
  const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
  const selectedEdgeIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id))
  return {
    nodes: nodes.filter((node) => !selectedNodeIds.has(node.id)),
    edges: edges.filter(
      (edge) =>
        !selectedEdgeIds.has(edge.id) &&
        !selectedNodeIds.has(edge.source) &&
        !selectedNodeIds.has(edge.target),
    ),
  }
}
