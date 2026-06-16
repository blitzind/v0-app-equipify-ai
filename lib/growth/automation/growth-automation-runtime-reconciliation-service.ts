import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getFlow, getFlowGraph } from "@/lib/growth/automation/growth-automation-repository"
import type { GrowthAutomationRuntimeReconciliationResult } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"
import { reconcileAutomationRuntimePreview } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-utils"

export async function previewAutomationRuntimeArtifacts(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; candidateVersionId?: string },
): Promise<GrowthAutomationRuntimeReconciliationResult> {
  const flow = await getFlow(admin, { flowId: input.flowId, organizationId: input.organizationId })
  const candidateGraph = await getFlowGraph(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    versionId: input.candidateVersionId,
  })

  let previousPublishedVersion = null
  let previousNodes: Awaited<ReturnType<typeof getFlowGraph>>["nodes"] = []
  let previousEdges: Awaited<ReturnType<typeof getFlowGraph>>["edges"] = []

  if (flow.publishedVersionId) {
    const previousGraph = await getFlowGraph(admin, {
      flowId: input.flowId,
      organizationId: input.organizationId,
      versionId: flow.publishedVersionId,
    })
    previousPublishedVersion = previousGraph.version
    previousNodes = previousGraph.nodes
    previousEdges = previousGraph.edges
  }

  return reconcileAutomationRuntimePreview({
    flow,
    candidateVersion: candidateGraph.version,
    candidateNodes: candidateGraph.nodes,
    candidateEdges: candidateGraph.edges,
    previousPublishedVersion,
    previousNodes,
    previousEdges,
  })
}

export async function getAutomationRuntimeReconciliation(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; candidateVersionId?: string },
): Promise<GrowthAutomationRuntimeReconciliationResult> {
  return previewAutomationRuntimeArtifacts(admin, input)
}
