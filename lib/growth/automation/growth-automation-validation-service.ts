/** Growth Engine S5-B — read-only automation graph validation (client-safe). */

import {
  GROWTH_AUTOMATION_NODE_TYPES,
  type GrowthAutomationEdge,
  type GrowthAutomationNode,
  type GrowthAutomationValidationIssue,
  type GrowthAutomationValidationResult,
  isSendAutomationActionConfig,
} from "@/lib/growth/automation/growth-automation-types"

function issue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
  nodeId?: string | null,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: nodeId ?? null }
}

function buildAdjacency(edges: GrowthAutomationEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const next = adjacency.get(edge.fromNodeId) ?? []
    next.push(edge.toNodeId)
    adjacency.set(edge.fromNodeId, next)
  }
  return adjacency
}

function collectReachable(triggerIds: string[], adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>()
  const queue = [...triggerIds]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }
  return visited
}

function detectCycleWithoutWait(
  nodes: GrowthAutomationNode[],
  edges: GrowthAutomationEdge[],
): string[] {
  const waitNodeIds = new Set(nodes.filter((node) => node.nodeType === "wait").map((node) => node.id))
  const adjacency = buildAdjacency(edges)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycleNodes: string[] = []

  function dfs(nodeId: string, path: string[]): boolean {
    if (visiting.has(nodeId)) {
      cycleNodes.push(...path.slice(path.indexOf(nodeId)))
      return true
    }
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    path.push(nodeId)
    for (const next of adjacency.get(nodeId) ?? []) {
      if (waitNodeIds.has(next)) continue
      if (dfs(next, path)) return true
    }
    path.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  for (const node of nodes) {
    if (dfs(node.id, [])) break
  }
  return [...new Set(cycleNodes)]
}

function hasUpstreamApproval(nodeId: string, edges: GrowthAutomationEdge[], nodesById: Map<string, GrowthAutomationNode>): boolean {
  const incoming = edges.filter((edge) => edge.toNodeId === nodeId).map((edge) => edge.fromNodeId)
  const visited = new Set<string>()
  const queue = [...incoming]
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

export function validateAutomationGraph(input: {
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
}): GrowthAutomationValidationResult {
  const errors: GrowthAutomationValidationIssue[] = []
  const warnings: GrowthAutomationValidationIssue[] = []
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]))
  const nodeIds = new Set(input.nodes.map((node) => node.id))

  const triggerNodes = input.nodes.filter((node) => node.nodeType === "trigger")
  const exitNodes = input.nodes.filter((node) => node.nodeType === "exit")

  if (triggerNodes.length !== 1) {
    errors.push(
      issue(
        "error",
        "exactly_one_trigger",
        triggerNodes.length === 0
          ? "Automation flow requires exactly one trigger node."
          : `Automation flow has ${triggerNodes.length} trigger nodes; exactly one is required.`,
      ),
    )
  }

  if (exitNodes.length === 0) {
    errors.push(issue("error", "at_least_one_exit", "Automation flow requires at least one exit node."))
  }

  for (const edge of input.edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      errors.push(
        issue(
          "error",
          "missing_edge_target",
          "Edge references a missing node.",
          !nodeIds.has(edge.fromNodeId) ? edge.fromNodeId : edge.toNodeId,
        ),
      )
    }
  }

  for (const node of input.nodes) {
    if (!node.label.trim() && node.nodeType !== "exit") {
      warnings.push(issue("warning", "missing_node_label", "Node is missing a label.", node.id))
    }

    if (node.nodeType === "trigger") {
      const triggerSource = typeof node.configJson.triggerSource === "string" ? node.configJson.triggerSource : ""
      if (!triggerSource.trim()) {
        errors.push(issue("error", "invalid_trigger_config", "Trigger node requires triggerSource config.", node.id))
      }
    }

    if (node.nodeType === "action" && isSendAutomationActionConfig(node.configJson)) {
      if (!hasUpstreamApproval(node.id, input.edges, nodesById)) {
        errors.push(
          issue(
            "error",
            "send_action_missing_approval",
            "Send actions require an approval node upstream.",
            node.id,
          ),
        )
      }
    }

    if (!(GROWTH_AUTOMATION_NODE_TYPES as readonly string[]).includes(node.nodeType)) {
      errors.push(issue("error", "invalid_node_type", `Invalid node type: ${node.nodeType}.`, node.id))
    }
  }

  const adjacency = buildAdjacency(input.edges)
  const reachable = collectReachable(
    triggerNodes.map((node) => node.id),
    adjacency,
  )
  const unreachableNodes = input.nodes.filter((node) => !reachable.has(node.id))
  for (const node of unreachableNodes) {
    warnings.push(issue("warning", "unreachable_node", "Node is unreachable from trigger.", node.id))
  }

  const incomingCounts = new Map<string, number>()
  for (const edge of input.edges) {
    incomingCounts.set(edge.toNodeId, (incomingCounts.get(edge.toNodeId) ?? 0) + 1)
  }
  const orphanNodes = input.nodes.filter(
    (node) => node.nodeType !== "trigger" && (incomingCounts.get(node.id) ?? 0) === 0,
  )
  for (const node of orphanNodes) {
    warnings.push(issue("warning", "orphan_node", "Node has no incoming edges.", node.id))
  }

  const cycleNodes = detectCycleWithoutWait(input.nodes, input.edges)
  for (const nodeId of cycleNodes) {
    errors.push(
      issue(
        "error",
        "cycle_without_wait",
        "Graph cycle detected without an intervening wait node.",
        nodeId,
      ),
    )
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    graphStats: {
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      triggerCount: triggerNodes.length,
      exitCount: exitNodes.length,
      unreachableNodeCount: unreachableNodes.length,
      orphanNodeCount: orphanNodes.length,
    },
  }
}
