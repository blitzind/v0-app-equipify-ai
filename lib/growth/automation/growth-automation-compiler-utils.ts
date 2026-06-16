/** Growth Engine S5-D — compiler mapping helpers (client-safe). */

import {
  SEQUENCE_CONDITION_DSL_VERSION,
  SEQUENCE_CONDITION_EVENT_TO_SOURCE,
  parseSequenceConditionSpec,
  type SequenceConditionEvent,
  type SequenceConditionSpec,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS,
  GROWTH_AUTOMATION_COMPILER_SUPPORTED_TRIGGERS,
  type GrowthAutomationCompileIssue,
  type GrowthAutomationCompilerSupportedAction,
  type GrowthAutomationCompilerSupportedTrigger,
} from "@/lib/growth/automation/growth-automation-compiler-types"
import type { GrowthAutomationEdge, GrowthAutomationNode } from "@/lib/growth/automation/growth-automation-types"

export function compileIssue(
  severity: GrowthAutomationCompileIssue["severity"],
  ruleCode: string,
  message: string,
  nodeId?: string | null,
): GrowthAutomationCompileIssue {
  return { severity, ruleCode, message, nodeId: nodeId ?? null }
}

export function isSupportedCompilerTrigger(value: string): value is GrowthAutomationCompilerSupportedTrigger {
  return (GROWTH_AUTOMATION_COMPILER_SUPPORTED_TRIGGERS as readonly string[]).includes(value)
}

export function isSupportedCompilerAction(value: string): value is GrowthAutomationCompilerSupportedAction {
  return (GROWTH_AUTOMATION_COMPILER_SUPPORTED_ACTIONS as readonly string[]).includes(value)
}

export function isSendCompilerAction(actionType: string): boolean {
  return actionType === "send_email" || actionType === "send_sms" || actionType === "send_voice_drop"
}

export function mapTriggerSourceToEntryTrigger(triggerSource: string): {
  triggerKey: string
  conditionSource: string | null
  conditionEvent: string | null
  enrollmentMode?: "manual"
  error?: string
} {
  if (triggerSource === "manual.enrollment") {
    return {
      triggerKey: "manual.enrollment",
      conditionSource: null,
      conditionEvent: null,
      enrollmentMode: "manual",
    }
  }

  if (!isSupportedCompilerTrigger(triggerSource)) {
    return {
      triggerKey: triggerSource,
      conditionSource: null,
      conditionEvent: null,
      error: `Unsupported triggerSource: ${triggerSource}`,
    }
  }

  const event = triggerSource as SequenceConditionEvent
  const source = SEQUENCE_CONDITION_EVENT_TO_SOURCE[event]
  return {
    triggerKey: triggerSource,
    conditionSource: source,
    conditionEvent: event,
  }
}

export function buildConditionSpecFromNode(node: GrowthAutomationNode): {
  spec: SequenceConditionSpec | null
  error?: string
} {
  const rawSpec = node.configJson.conditionSpec
  if (rawSpec) {
    const parsed = parseSequenceConditionSpec(rawSpec)
    if (!parsed.ok) return { spec: null, error: parsed.message }
    return { spec: parsed.spec }
  }

  const source = typeof node.configJson.source === "string" ? node.configJson.source.trim() : ""
  const event = typeof node.configJson.event === "string" ? node.configJson.event.trim() : ""
  if (source && event) {
    const parsed = parseSequenceConditionSpec({
      dslVersion: SEQUENCE_CONDITION_DSL_VERSION,
      source,
      event,
    })
    if (!parsed.ok) return { spec: null, error: parsed.message }
    return { spec: parsed.spec }
  }

  return { spec: null, error: "Condition node requires conditionSpec or source/event config." }
}

export function actionTypeToChannel(actionType: string): string | null {
  switch (actionType) {
    case "send_email":
      return "email"
    case "send_sms":
      return "sms"
    case "send_voice_drop":
      return "voice_drop"
    default:
      return null
  }
}

export function hasUpstreamApprovalNode(
  nodeId: string,
  nodesById: Map<string, GrowthAutomationNode>,
  edges: GrowthAutomationEdge[],
): boolean {
  const visited = new Set<string>()
  const queue = edges.filter((edge) => edge.toNodeId === nodeId).map((edge) => edge.fromNodeId)
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const node = nodesById.get(current)
    if (!node) continue
    if (node.nodeType === "approval") return true
    for (const edge of edges) {
      if (edge.toNodeId === current) queue.push(edge.fromNodeId)
    }
  }
  return false
}

export function topologicalStepOrder(
  startNodeId: string,
  edges: GrowthAutomationEdge[],
  nodesById: Map<string, GrowthAutomationNode>,
): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  const queue = [startNodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    if (nodesById.has(current)) order.push(current)
    for (const edge of edges.filter((entry) => entry.fromNodeId === current)) {
      if (!visited.has(edge.toNodeId)) queue.push(edge.toNodeId)
    }
  }
  for (const node of nodesById.values()) {
    if (!visited.has(node.id)) order.push(node.id)
  }
  return order
}

export function draftId(prefix: string, nodeOrEdgeId: string): string {
  return `${prefix}-${nodeOrEdgeId}`
}
