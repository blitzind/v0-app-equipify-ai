/** Growth Engine S5-C — canvas ↔ S5-B persistence serialization (client-safe). */

import type {
  GrowthAutomationEdge,
  GrowthAutomationEdgeType,
  GrowthAutomationNode,
  GrowthAutomationNodeType,
  GrowthAutomationValidationIssue,
  GrowthAutomationValidationResult,
} from "@/lib/growth/automation/growth-automation-types"
import {
  GROWTH_AUTOMATION_CANVAS_NODE_TYPES,
  GROWTH_AUTOMATION_CANVAS_QA_MARKER,
  GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
  type AutomationCanvasEdge,
  type AutomationCanvasNode,
  type GrowthAutomationCanvasEdgeType,
  type GrowthAutomationCanvasExport,
  type GrowthAutomationCanvasNodeType,
  type GrowthAutomationCanvasState,
} from "@/lib/growth/automation/growth-automation-canvas-types"
import { createCanvasEdge, createCanvasNode } from "@/lib/growth/automation/growth-automation-canvas-utils"

const CANVAS_GOAL_MARKER = "goal"
const CANVAS_BRANCH_MARKER = "branch"

function persistenceNodeTypeToCanvas(node: GrowthAutomationNode): GrowthAutomationCanvasNodeType {
  const canvasOverride =
    typeof node.configJson.canvasNodeType === "string" ? node.configJson.canvasNodeType : null
  if (canvasOverride === CANVAS_GOAL_MARKER) return "goal"
  if (node.nodeType === "branch") return "condition"
  if (node.nodeType === "exit" && canvasOverride === CANVAS_GOAL_MARKER) return "goal"
  if ((GROWTH_AUTOMATION_CANVAS_NODE_TYPES as readonly string[]).includes(node.nodeType)) {
    return node.nodeType as GrowthAutomationCanvasNodeType
  }
  return "action"
}

function canvasNodeTypeToPersistence(nodeType: GrowthAutomationCanvasNodeType): GrowthAutomationNodeType {
  switch (nodeType) {
    case "goal":
      return "exit"
    case "condition":
      return "condition"
    default:
      if ((["trigger", "wait", "approval", "action", "exit"] as const).includes(nodeType as never)) {
        return nodeType as GrowthAutomationNodeType
      }
      return "action"
  }
}

function persistenceEdgeTypeToCanvas(edgeType: GrowthAutomationEdgeType): GrowthAutomationCanvasEdgeType {
  switch (edgeType) {
    case "conditional_true":
      return "yes"
    case "conditional_false":
      return "no"
    case "timeout":
      return "timeout"
    case "fallback":
      return "failure"
    default:
      return "default"
  }
}

function canvasEdgeTypeToPersistence(edgeType: GrowthAutomationCanvasEdgeType): GrowthAutomationEdgeType {
  switch (edgeType) {
    case "yes":
      return "conditional_true"
    case "no":
      return "conditional_false"
    case "timeout":
      return "timeout"
    case "failure":
      return "fallback"
    case "success":
      return "default"
    default:
      return "default"
  }
}

export function flowToReactFlow(input: {
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
}): GrowthAutomationCanvasState {
  const nodes: AutomationCanvasNode[] = input.nodes.map((node) => {
    const canvasNodeType = persistenceNodeTypeToCanvas(node)
    const description =
      typeof node.configJson.description === "string" ? node.configJson.description : ""
    return createCanvasNode({
      id: node.id,
      nodeType: canvasNodeType,
      position: { x: node.positionX, y: node.positionY },
      label: node.label,
      description,
      config: node.configJson,
      persistenceNodeId: node.id,
    })
  })

  const edges: AutomationCanvasEdge[] = input.edges.map((edge) =>
    createCanvasEdge({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      edgeType: persistenceEdgeTypeToCanvas(edge.edgeType),
      persistenceEdgeId: edge.id,
    }),
  )

  return { nodes, edges }
}

export function reactFlowToPersistence(input: {
  nodes: AutomationCanvasNode[]
  edges: AutomationCanvasEdge[]
}): {
  nodes: Array<{
    clientId: string
    persistenceId?: string
    nodeType: GrowthAutomationNodeType
    label: string
    positionX: number
    positionY: number
    configJson: Record<string, unknown>
  }>
  edges: Array<{
    clientId: string
    persistenceId?: string
    fromNodeId: string
    toNodeId: string
    edgeType: GrowthAutomationEdgeType
  }>
} {
  const idMap = new Map<string, string>()
  for (const node of input.nodes) {
    idMap.set(node.id, node.data.persistenceNodeId ?? node.id)
  }

  const nodes = input.nodes.map((node) => {
    const canvasNodeType = node.data.canvasNodeType
    const nodeType = canvasNodeTypeToPersistence(canvasNodeType)
    const configJson = {
      ...node.data.config,
      description: node.data.description,
      canvasNodeType: canvasNodeType === "goal" ? CANVAS_GOAL_MARKER : canvasNodeType,
    }
    return {
      clientId: node.id,
      persistenceId: node.data.persistenceNodeId,
      nodeType,
      label: node.data.label,
      positionX: node.position.x,
      positionY: node.position.y,
      configJson,
    }
  })

  const edges = input.edges.map((edge) => ({
    clientId: edge.id,
    persistenceId: edge.data?.persistenceEdgeId,
    fromNodeId: edge.source,
    toNodeId: edge.target,
    edgeType: canvasEdgeTypeToPersistence(edge.data?.canvasEdgeType ?? "default"),
  }))

  return { nodes, edges }
}

export function exportCanvasState(state: GrowthAutomationCanvasState): GrowthAutomationCanvasExport {
  return {
    qa_marker: GROWTH_AUTOMATION_CANVAS_QA_MARKER,
    version: 1,
    exported_at: new Date().toISOString(),
    canvas: state,
    safety_flags: GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
  }
}

export function importCanvasState(raw: unknown): GrowthAutomationCanvasState {
  if (!raw || typeof raw !== "object") throw new Error("invalid_canvas_export")
  const payload = raw as Partial<GrowthAutomationCanvasExport>
  if (!payload.canvas || !Array.isArray(payload.canvas.nodes) || !Array.isArray(payload.canvas.edges)) {
    throw new Error("invalid_canvas_export")
  }
  return {
    nodes: payload.canvas.nodes as AutomationCanvasNode[],
    edges: payload.canvas.edges as AutomationCanvasEdge[],
    viewport: payload.canvas.viewport,
  }
}

export function applyValidationOverlays(
  nodes: AutomationCanvasNode[],
  validation: GrowthAutomationValidationResult,
): AutomationCanvasNode[] {
  const issuesByNode = new Map<string, GrowthAutomationValidationIssue[]>()
  for (const issue of [...validation.errors, ...validation.warnings]) {
    if (!issue.nodeId) continue
    const list = issuesByNode.get(issue.nodeId) ?? []
    list.push(issue)
    issuesByNode.set(issue.nodeId, list)
  }

  return nodes.map((node) => {
    const persistenceId = node.data.persistenceNodeId ?? node.id
    const issues = issuesByNode.get(persistenceId) ?? []
    const hasError = issues.some((issue) => issue.severity === "error")
    const hasWarning = issues.some((issue) => issue.severity === "warning")
    return {
      ...node,
      data: {
        ...node.data,
        validation: hasError ? "error" : hasWarning ? "warning" : issues.length > 0 ? "valid" : node.data.validation,
        validationMessages: issues.map((issue) => issue.message),
      },
    }
  })
}
