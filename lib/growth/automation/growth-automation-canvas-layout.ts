/** Growth Engine S5-C — deterministic auto-layout (client-safe). */

import type {
  AutomationCanvasEdge,
  AutomationCanvasNode,
  GrowthAutomationCanvasLayoutMode,
} from "@/lib/growth/automation/growth-automation-canvas-types"

const NODE_WIDTH = 180
const NODE_HEIGHT = 72
const GAP_X = 48
const GAP_Y = 64

function buildLevels(nodes: AutomationCanvasNode[], edges: AutomationCanvasEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    const list = incoming.get(edge.target) ?? []
    list.push(edge.source)
    incoming.set(edge.target, list)
  }

  const levels = new Map<string, number>()
  const roots = nodes.filter((node) => (incoming.get(node.id) ?? []).length === 0)
  const queue = roots.map((node) => ({ id: node.id, level: 0 }))
  while (queue.length > 0) {
    const current = queue.shift()!
    const prev = levels.get(current.id)
    if (prev !== undefined && prev >= current.level) continue
    levels.set(current.id, current.level)
    for (const edge of edges.filter((entry) => entry.source === current.id)) {
      queue.push({ id: edge.target, level: current.level + 1 })
    }
  }
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0)
  }
  return levels
}

function groupByLevel(levels: Map<string, number>): Map<number, string[]> {
  const grouped = new Map<number, string[]>()
  for (const [nodeId, level] of levels.entries()) {
    const list = grouped.get(level) ?? []
    list.push(nodeId)
    grouped.set(level, list)
  }
  return grouped
}

export function autoLayoutCanvasNodes(
  nodes: AutomationCanvasNode[],
  edges: AutomationCanvasEdge[],
  mode: GrowthAutomationCanvasLayoutMode,
): AutomationCanvasNode[] {
  if (nodes.length === 0) return nodes
  const levels = buildLevels(nodes, edges)
  const grouped = groupByLevel(levels)
  const positioned = new Map<string, { x: number; y: number }>()

  for (const [level, nodeIds] of grouped.entries()) {
    nodeIds.forEach((nodeId, index) => {
      const offset = (index - (nodeIds.length - 1) / 2) * (NODE_WIDTH + GAP_X)
      if (mode === "left_to_right") {
        positioned.set(nodeId, {
          x: 80 + level * (NODE_WIDTH + GAP_X),
          y: 120 + offset,
        })
      } else {
        positioned.set(nodeId, {
          x: 120 + offset,
          y: 80 + level * (NODE_HEIGHT + GAP_Y),
        })
      }
    })
  }

  if (mode === "tree" || mode === "dag") {
    for (const [level, nodeIds] of grouped.entries()) {
      const span = nodeIds.length * (NODE_WIDTH + GAP_X)
      nodeIds.forEach((nodeId, index) => {
        positioned.set(nodeId, {
          x: 120 + index * (NODE_WIDTH + GAP_X) - span / 2 + NODE_WIDTH / 2,
          y: 80 + level * (NODE_HEIGHT + GAP_Y),
        })
      })
    }
  }

  return nodes.map((node) => {
    const next = positioned.get(node.id) ?? node.position
    return { ...node, position: next }
  })
}
