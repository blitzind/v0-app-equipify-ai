import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { compileAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-compiler-service"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import { simulateAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-simulation-service"
import type {
  GrowthAutomationSimulationInput,
  GrowthAutomationSimulationResult,
} from "@/lib/growth/automation/growth-automation-simulation-types"
import {
  archiveFlow,
  cloneVersionGraph,
  createDraftFromPublishedVersionMetadata,
  createEdge,
  createFlow,
  createNode,
  createVersion,
  deleteEdge,
  deleteNode,
  getFlow,
  getFlowGraph,
  listFlows,
  listVersions,
  publishAutomationFlowVersionMetadata,
  publishVersionPlaceholder,
  unpublishAutomationFlowMetadata,
  updateEdge,
  updateFlow,
  updateNode,
} from "@/lib/growth/automation/growth-automation-repository"
import { validateAutomationGraph } from "@/lib/growth/automation/growth-automation-validation-service"
import type { GrowthAutomationValidationResult } from "@/lib/growth/automation/growth-automation-types"

export {
  archiveFlow,
  cloneVersionGraph,
  createDraftFromPublishedVersionMetadata,
  createEdge,
  createFlow,
  createNode,
  createVersion,
  deleteEdge,
  deleteNode,
  getFlow,
  getFlowGraph,
  listFlows,
  listVersions,
  publishAutomationFlowVersionMetadata,
  publishVersionPlaceholder,
  unpublishAutomationFlowMetadata,
  updateEdge,
  updateFlow,
  updateNode,
}

export async function validateFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string },
): Promise<GrowthAutomationValidationResult> {
  const graph = await getFlowGraph(admin, input)
  return validateAutomationGraph({ nodes: graph.nodes, edges: graph.edges })
}

export async function compileAutomationFlowPreview(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string },
): Promise<GrowthAutomationCompileResult> {
  const graph = await getFlowGraph(admin, input)
  return compileAutomationFlowGraph({
    compileId: randomUUID(),
    flow: graph.flow,
    version: graph.version,
    nodes: graph.nodes,
    edges: graph.edges,
  })
}

export async function simulateAutomationFlowPreview(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    versionId?: string
    simulationInput?: GrowthAutomationSimulationInput
  },
): Promise<GrowthAutomationSimulationResult> {
  const graph = await getFlowGraph(admin, input)
  return simulateAutomationFlowGraph({
    simulationId: randomUUID(),
    flow: graph.flow,
    version: graph.version,
    nodes: graph.nodes,
    edges: graph.edges,
    simulationInput: input.simulationInput,
  })
}
