import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { compileAutomationFlowGraph } from "@/lib/growth/automation/growth-automation-compiler-service"
import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"
import {
  clearAutomationRuntimePublish,
  getFlow,
  getFlowGraph,
  linkAutomationRuntimePublish,
  updateAutomationRuntimeMetadata,
} from "@/lib/growth/automation/growth-automation-repository"
import { previewAutomationRuntimeArtifacts } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-service"
import {
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
  type GrowthAutomationRuntimeActivationResult,
  type GrowthAutomationRuntimeMetadata,
  type GrowthAutomationRuntimePublishResult,
  type GrowthAutomationRuntimeStatusResult,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import {
  appendRuntimePublishHistory,
  buildAutomationPatternKey,
  buildInitialRuntimeMetadata,
  buildRuntimeStatsFromCompile,
  canActivateRuntimeMetadata,
  canPauseRuntimeMetadata,
  extractRuntimeMetadata,
  mergeRuntimeMetadataIntoCanvasLayout,
  overlayFlowStatusForRuntime,
  resolveCompiledStepChannel,
  resolveEffectiveFlowStatus,
  validateRuntimeActivationGates,
  validateRuntimePublishGates,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-utils"
import { graphHasActionNodes } from "@/lib/growth/automation/growth-automation-publish-utils"
import { setGrowthSequencePatternActive } from "@/lib/growth/sequence-pattern-repository"
import { createCondition, createEdge } from "@/lib/growth/sequences/conditions/sequence-condition-repository"

type MaterializedArtifacts = {
  patternId: string
  patternKey: string
  draftStepToPatternStepId: Map<string, string>
  draftConditionToConditionId: Map<string, string>
  edgeIds: string[]
  stats: GrowthAutomationRuntimeMetadata["runtimeStats"]
}

async function findOrCreatePattern(
  admin: SupabaseClient,
  input: {
    patternKey: string
    label: string
    description: string
    flowId: string
    versionId: string
    organizationId: string
    entryTriggerKey: string
  },
): Promise<string> {
  const existing = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id")
    .eq("key", input.patternKey)
    .maybeSingle()

  if (existing.data?.id) return String(existing.data.id)

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .insert({
      key: input.patternKey,
      label: input.label,
      description: input.description,
      pattern_kind: "catalog",
      is_active: false,
      metadata: {
        qa_marker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
        automation_flow_id: input.flowId,
        automation_version_id: input.versionId,
        organization_id: input.organizationId,
        entry_trigger_key: input.entryTriggerKey,
        execution_enabled: false,
      },
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? "runtime_pattern_create_failed")
  return String(data.id)
}

async function materializeCompiledArtifacts(
  admin: SupabaseClient,
  input: {
    compile: GrowthAutomationCompileResult
    patternKey: string
    flowName: string
    flowDescription: string
  },
): Promise<MaterializedArtifacts> {
  const draft = input.compile.compiledPatternDraft
  if (!draft) throw new Error("runtime_publish_missing_pattern_draft")

  const patternId = await findOrCreatePattern(admin, {
    patternKey: input.patternKey,
    label: `${input.flowName} · SR-3`,
    description: input.flowDescription || `Automation runtime pattern for ${draft.flowName}`,
    flowId: draft.flowId,
    versionId: draft.versionId,
    organizationId: draft.organizationId,
    entryTriggerKey: draft.entryTrigger.triggerKey,
  })

  const draftStepToPatternStepId = new Map<string, string>()

  for (const step of input.compile.compiledSteps) {
    const existing = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .select("id")
      .eq("pattern_id", patternId)
      .eq("step_order", step.stepOrder)
      .maybeSingle()

    const channel = resolveCompiledStepChannel(step)
    const payload = {
      pattern_id: patternId,
      step_order: step.stepOrder,
      channel,
      delay_days_min: 0,
      delay_days_max: 0,
      required_human_approval: true,
      generation_type: step.actionType ?? step.nodeType,
      expected_signal: step.terminal ? "no_signal" : "reply",
    }

    if (existing.data?.id) {
      const stepId = String(existing.data.id)
      await admin
        .schema("growth")
        .from("sequence_pattern_steps")
        .update(payload)
        .eq("id", stepId)
      draftStepToPatternStepId.set(step.draftStepId, stepId)
      continue
    }

    const { data, error } = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .insert(payload)
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message ?? "runtime_pattern_step_create_failed")
    draftStepToPatternStepId.set(step.draftStepId, String(data.id))
  }

  const draftConditionToConditionId = new Map<string, string>()
  for (const condition of input.compile.compiledConditions) {
    const stepDraft = input.compile.compiledSteps.find(
      (step) => step.automationNodeId === condition.automationNodeId,
    )
    const patternStepId = stepDraft ? draftStepToPatternStepId.get(stepDraft.draftStepId) : null
    if (!patternStepId) throw new Error("runtime_publish_missing_condition_step")

    const existing = await admin
      .schema("growth")
      .from("sequence_pattern_step_conditions")
      .select("id")
      .eq("pattern_step_id", patternStepId)
      .eq("condition_key", condition.conditionKey)
      .maybeSingle()

    if (existing.data?.id) {
      draftConditionToConditionId.set(condition.draftConditionId, String(existing.data.id))
      continue
    }

    const waitDraft = input.compile.compiledWaits.find(
      (wait) => wait.automationNodeId === condition.automationNodeId,
    )
    const created = await createCondition(admin, {
      patternStepId,
      conditionKey: condition.conditionKey,
      spec: condition.spec,
      label: condition.conditionKey,
      durationSeconds: waitDraft?.durationSeconds ?? null,
    })
    draftConditionToConditionId.set(condition.draftConditionId, created.id)
  }

  const edgeIds: string[] = []
  for (const edge of input.compile.compiledEdges) {
    const fromPatternStepId = draftStepToPatternStepId.get(edge.fromDraftStepId)
    const toPatternStepId = draftStepToPatternStepId.get(edge.toDraftStepId)
    if (!fromPatternStepId || !toPatternStepId) {
      throw new Error("runtime_publish_missing_edge_step")
    }

    const conditionId = edge.conditionDraftId
      ? draftConditionToConditionId.get(edge.conditionDraftId) ?? null
      : null

    const existing = await admin
      .schema("growth")
      .from("sequence_pattern_step_edges")
      .select("id")
      .eq("pattern_id", patternId)
      .eq("from_pattern_step_id", fromPatternStepId)
      .eq("to_pattern_step_id", toPatternStepId)
      .eq("edge_type", edge.edgeType)
      .maybeSingle()

    if (existing.data?.id) {
      edgeIds.push(String(existing.data.id))
      continue
    }

    const created = await createEdge(admin, {
      patternId,
      fromPatternStepId,
      toPatternStepId,
      edgeType: edge.edgeType,
      conditionId,
      priority: edge.priority,
      label: edge.label,
    })
    edgeIds.push(created.id)
  }

  return {
    patternId,
    patternKey: input.patternKey,
    draftStepToPatternStepId,
    draftConditionToConditionId,
    edgeIds,
    stats: buildRuntimeStatsFromCompile(input.compile),
  }
}

async function loadPublishedGraph(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string },
) {
  const flow = await getFlow(admin, input)
  const versionId = input.versionId ?? flow.publishedVersionId
  if (!versionId) throw new Error("automation_published_version_missing")

  const graph = await getFlowGraph(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    versionId,
  })
  if (graph.version.lifecycle !== "published") throw new Error("version_not_published")
  return graph
}

export async function publishAutomationRuntimeArtifacts(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string; publishedBy?: string | null },
): Promise<GrowthAutomationRuntimePublishResult> {
  const graph = await loadPublishedGraph(admin, input)
  const reconciliation = await previewAutomationRuntimeArtifacts(admin, {
    flowId: graph.flow.id,
    organizationId: input.organizationId,
    candidateVersionId: graph.version.id,
  })
  const compile = compileAutomationFlowGraph(graph)
  const blocked = validateRuntimePublishGates({ reconciliation, compile, version: graph.version })

  if (blocked.length > 0) {
    const metadata = buildInitialRuntimeMetadata({
      compile,
      reconciliation,
      requiresHumanReview: graphHasActionNodes(graph.nodes),
    })
    return {
      ok: false,
      flow: graph.flow,
      version: graph.version,
      patternId: null,
      reconciliation,
      compile,
      metadata: { ...metadata, activationStatus: "failed" },
      effectiveFlowStatus: resolveEffectiveFlowStatus({
        flowStatus: graph.flow.status,
        activationStatus: "failed",
      }),
      errors: blocked,
    }
  }

  const patternKey = buildAutomationPatternKey({
    flowId: graph.flow.id,
    versionNumber: graph.version.versionNumber,
  })
  const materialized = await materializeCompiledArtifacts(admin, {
    compile,
    patternKey,
    flowName: graph.flow.name,
    flowDescription: graph.flow.description,
  })

  const priorMetadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)
  const artifactVersion = (priorMetadata?.publishedArtifactVersion ?? 0) + 1
  const publishedAt = new Date().toISOString()
  let metadata = buildInitialRuntimeMetadata({
    compile,
    reconciliation,
    requiresHumanReview: graphHasActionNodes(graph.nodes),
  })
  metadata = {
    ...metadata,
    activationStatus: "published",
    compiledPatternId: materialized.patternId,
    compiledVersionId: graph.version.id,
    publishedArtifactVersion: artifactVersion,
    lastPublishedAt: publishedAt,
    runtimeStats: materialized.stats,
  }
  metadata = appendRuntimePublishHistory(metadata, {
    publishedAt,
    patternId: materialized.patternId,
    versionId: graph.version.id,
    artifactVersion,
  })

  const canvasLayoutJson = mergeRuntimeMetadataIntoCanvasLayout({
    canvasLayoutJson: graph.version.canvasLayoutJson,
    metadata,
  })

  const nodeStepLinks = compile.compiledSteps
    .map((step) => {
      const patternStepId = materialized.draftStepToPatternStepId.get(step.draftStepId)
      return patternStepId ? { nodeId: step.automationNodeId, patternStepId } : null
    })
    .filter((entry): entry is { nodeId: string; patternStepId: string } => Boolean(entry))

  const edgeConditionLinks = compile.compiledEdges.map((edge) => ({
    edgeId: edge.automationEdgeId,
    conditionId: edge.conditionDraftId
      ? materialized.draftConditionToConditionId.get(edge.conditionDraftId) ?? null
      : null,
  }))

  const linked = await linkAutomationRuntimePublish(admin, {
    flowId: graph.flow.id,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    patternId: materialized.patternId,
    canvasLayoutJson,
    nodeStepLinks,
    edgeConditionLinks,
  })

  await setGrowthSequencePatternActive(admin, {
    patternId: materialized.patternId,
    isActive: false,
  })

  return {
    ok: true,
    flow: linked.flow,
    version: linked.version,
    patternId: materialized.patternId,
    reconciliation,
    compile,
    metadata,
    effectiveFlowStatus: resolveEffectiveFlowStatus({
      flowStatus: linked.flow.status,
      activationStatus: metadata.activationStatus,
    }),
    errors: [],
  }
}

export async function activateAutomationRuntime(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeActivationResult> {
  const graph = await loadPublishedGraph(admin, input)
  const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)
  const blocked = validateRuntimeActivationGates({
    metadata,
    patternId: graph.version.compiledPatternId,
  })

  if (blocked.length > 0) {
    return {
      ok: false,
      flow: graph.flow,
      version: graph.version,
      patternId: graph.version.compiledPatternId,
      metadata: metadata ?? buildInitialRuntimeMetadata({
        compile: compileAutomationFlowGraph(graph),
        reconciliation: await previewAutomationRuntimeArtifacts(admin, {
          flowId: graph.flow.id,
          organizationId: input.organizationId,
          candidateVersionId: graph.version.id,
        }),
        requiresHumanReview: true,
      }),
      effectiveFlowStatus: resolveEffectiveFlowStatus({
        flowStatus: graph.flow.status,
        activationStatus: metadata?.activationStatus ?? null,
      }),
    }
  }

  const patternId = graph.version.compiledPatternId!
  await setGrowthSequencePatternActive(admin, { patternId, isActive: true })

  const nextMetadata: GrowthAutomationRuntimeMetadata = {
    ...metadata!,
    activationStatus: "active",
    lastActivatedAt: new Date().toISOString(),
    executionEnabled: false,
  }
  const version = await updateAutomationRuntimeMetadata(admin, {
    flowId: graph.flow.id,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    canvasLayoutJson: mergeRuntimeMetadataIntoCanvasLayout({
      canvasLayoutJson: graph.version.canvasLayoutJson,
      metadata: nextMetadata,
    }),
  })

  const effectiveFlowStatus = resolveEffectiveFlowStatus({
    flowStatus: graph.flow.status,
    activationStatus: "active",
  })

  return {
    ok: true,
    flow: overlayFlowStatusForRuntime(graph.flow, effectiveFlowStatus),
    version,
    patternId,
    metadata: nextMetadata,
    effectiveFlowStatus,
  }
}

export async function pauseAutomationRuntime(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeActivationResult> {
  const graph = await loadPublishedGraph(admin, input)
  const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)
  if (!canPauseRuntimeMetadata(metadata) || !graph.version.compiledPatternId) {
    return {
      ok: false,
      flow: graph.flow,
      version: graph.version,
      patternId: graph.version.compiledPatternId,
      metadata,
      effectiveFlowStatus: resolveEffectiveFlowStatus({
        flowStatus: graph.flow.status,
        activationStatus: metadata?.activationStatus ?? null,
      }),
    }
  }

  await setGrowthSequencePatternActive(admin, {
    patternId: graph.version.compiledPatternId,
    isActive: false,
  })

  const nextMetadata: GrowthAutomationRuntimeMetadata = {
    ...metadata!,
    activationStatus: "paused",
    lastPausedAt: new Date().toISOString(),
    executionEnabled: false,
  }
  const version = await updateAutomationRuntimeMetadata(admin, {
    flowId: graph.flow.id,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    canvasLayoutJson: mergeRuntimeMetadataIntoCanvasLayout({
      canvasLayoutJson: graph.version.canvasLayoutJson,
      metadata: nextMetadata,
    }),
  })

  const effectiveFlowStatus = resolveEffectiveFlowStatus({
    flowStatus: graph.flow.status,
    activationStatus: "paused",
  })

  return {
    ok: true,
    flow: overlayFlowStatusForRuntime(graph.flow, effectiveFlowStatus),
    version,
    patternId: graph.version.compiledPatternId,
    metadata: nextMetadata,
    effectiveFlowStatus,
  }
}

export async function rollbackAutomationRuntimePublish(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeActivationResult> {
  const graph = await loadPublishedGraph(admin, input)
  const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)

  if (graph.version.compiledPatternId) {
    await setGrowthSequencePatternActive(admin, {
      patternId: graph.version.compiledPatternId,
      isActive: false,
    })
  }

  const nextMetadata: GrowthAutomationRuntimeMetadata = {
    ...(metadata ??
      buildInitialRuntimeMetadata({
        compile: compileAutomationFlowGraph(graph),
        reconciliation: await previewAutomationRuntimeArtifacts(admin, {
          flowId: graph.flow.id,
          organizationId: input.organizationId,
          candidateVersionId: graph.version.id,
        }),
        requiresHumanReview: false,
      })),
    activationStatus: "archived",
    compiledPatternId: null,
    executionEnabled: false,
  }

  const version = await clearAutomationRuntimePublish(admin, {
    flowId: graph.flow.id,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    canvasLayoutJson: mergeRuntimeMetadataIntoCanvasLayout({
      canvasLayoutJson: graph.version.canvasLayoutJson,
      metadata: nextMetadata,
    }),
  })

  return {
    ok: true,
    flow: graph.flow,
    version,
    patternId: null,
    metadata: nextMetadata,
    effectiveFlowStatus: resolveEffectiveFlowStatus({
      flowStatus: graph.flow.status,
      activationStatus: "archived",
    }),
  }
}

export async function getAutomationRuntimeStatus(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeStatusResult> {
  const flow = await getFlow(admin, input)
  const publishedVersion = flow.publishedVersionId
    ? (
        await getFlowGraph(admin, {
          flowId: flow.id,
          organizationId: input.organizationId,
          versionId: flow.publishedVersionId,
        })
      ).version
    : null

  const metadata = publishedVersion ? extractRuntimeMetadata(publishedVersion.canvasLayoutJson) : null
  let patternActive: boolean | null = null
  let artifactCounts = metadata?.runtimeStats ?? null

  if (publishedVersion?.compiledPatternId) {
    const pattern = await admin
      .schema("growth")
      .from("sequence_patterns")
      .select("is_active")
      .eq("id", publishedVersion.compiledPatternId)
      .maybeSingle()
    patternActive = pattern.data ? Boolean(pattern.data.is_active) : null

    const { data: stepRows } = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .select("id")
      .eq("pattern_id", publishedVersion.compiledPatternId)
    const stepIds = (stepRows ?? []).map((row) => String(row.id))

    const [conditions, edges] = await Promise.all([
      stepIds.length > 0
        ? admin
            .schema("growth")
            .from("sequence_pattern_step_conditions")
            .select("id", { count: "exact", head: true })
            .in("pattern_step_id", stepIds)
        : Promise.resolve({ count: 0 }),
      admin
        .schema("growth")
        .from("sequence_pattern_step_edges")
        .select("id", { count: "exact", head: true })
        .eq("pattern_id", publishedVersion.compiledPatternId),
    ])

    artifactCounts = {
      stepCount: stepIds.length,
      conditionCount: conditions.count ?? 0,
      edgeCount: edges.count ?? 0,
      waitCount: metadata?.runtimeStats?.waitCount ?? 0,
      patternStepCount: stepIds.length,
    }
  }

  const effectiveFlowStatus = resolveEffectiveFlowStatus({
    flowStatus: flow.status,
    activationStatus: metadata?.activationStatus ?? null,
  })

  const graph = publishedVersion
    ? await getFlowGraph(admin, {
        flowId: flow.id,
        organizationId: input.organizationId,
        versionId: publishedVersion.id,
      })
    : null
  const reconciliation = graph
    ? await previewAutomationRuntimeArtifacts(admin, {
        flowId: flow.id,
        organizationId: input.organizationId,
        candidateVersionId: graph.version.id,
      })
    : null
  const compile = graph ? compileAutomationFlowGraph(graph) : null
  const publishBlocked =
    graph && reconciliation && compile
      ? validateRuntimePublishGates({ reconciliation, compile, version: graph.version })
      : ["missing_published_version"]
  const activationBlocked = validateRuntimeActivationGates({
    metadata,
    patternId: publishedVersion?.compiledPatternId ?? null,
  })

  return {
    flow: overlayFlowStatusForRuntime(flow, effectiveFlowStatus),
    publishedVersion,
    metadata,
    effectiveFlowStatus,
    patternActive,
    artifactCounts,
    activationReadiness: {
      canPublish: publishBlocked.length === 0,
      canActivate: canActivateRuntimeMetadata(metadata) && activationBlocked.length === 0,
      canPause: canPauseRuntimeMetadata(metadata),
      blockedReasons: [...new Set([...publishBlocked, ...activationBlocked])],
    },
  }
}
