/** Growth Engine S5-C — React Flow canvas types (client-safe). */

import type { Edge, Node } from "reactflow"

export const GROWTH_AUTOMATION_CANVAS_QA_MARKER = "growth-automation-canvas-s5c-v1" as const

export const GROWTH_AUTOMATION_CANVAS_NODE_TYPES = [
  "trigger",
  "condition",
  "wait",
  "approval",
  "action",
  "goal",
  "exit",
] as const
export type GrowthAutomationCanvasNodeType = (typeof GROWTH_AUTOMATION_CANVAS_NODE_TYPES)[number]

export const GROWTH_AUTOMATION_CANVAS_EDGE_TYPES = [
  "default",
  "success",
  "failure",
  "yes",
  "no",
  "timeout",
] as const
export type GrowthAutomationCanvasEdgeType = (typeof GROWTH_AUTOMATION_CANVAS_EDGE_TYPES)[number]

export const GROWTH_AUTOMATION_CANVAS_LAYOUT_MODES = [
  "top_to_bottom",
  "left_to_right",
  "tree",
  "dag",
] as const
export type GrowthAutomationCanvasLayoutMode = (typeof GROWTH_AUTOMATION_CANVAS_LAYOUT_MODES)[number]

export const GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS = {
  read_only_runtime: true,
  compiler_execution_enabled: false,
  simulation_execution_enabled: false,
  automation_execution_enabled: false,
  no_background_jobs: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
  no_realtime_collaboration: true,
} as const

export type GrowthAutomationCanvasNodeValidation = "pending" | "valid" | "warning" | "error"

export type GrowthAutomationCanvasNodeData = {
  label: string
  description: string
  config: Record<string, unknown>
  validation: GrowthAutomationCanvasNodeValidation
  validationMessages: string[]
  disabled: boolean
  canvasNodeType: GrowthAutomationCanvasNodeType
  persistenceNodeId?: string
}

export type GrowthAutomationCanvasEdgeData = {
  label: string
  canvasEdgeType: GrowthAutomationCanvasEdgeType
  persistenceEdgeId?: string
}

export type AutomationCanvasNode = Node<GrowthAutomationCanvasNodeData>
export type AutomationCanvasEdge = Edge<GrowthAutomationCanvasEdgeData>

export type GrowthAutomationCanvasState = {
  nodes: AutomationCanvasNode[]
  edges: AutomationCanvasEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export type GrowthAutomationCanvasExport = {
  qa_marker: typeof GROWTH_AUTOMATION_CANVAS_QA_MARKER
  version: 1
  exported_at: string
  canvas: GrowthAutomationCanvasState
  safety_flags: typeof GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS
}
