import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  type GrowthAutomationEdge,
  type GrowthAutomationEdgeType,
  type GrowthAutomationFlow,
  type GrowthAutomationFlowStatus,
  type GrowthAutomationFlowVersion,
  type GrowthAutomationNode,
  type GrowthAutomationNodeType,
  type GrowthAutomationNodeValidationState,
  type GrowthAutomationVersionLifecycle,
  canArchiveAutomationFlow,
  canEditAutomationDraftVersion,
} from "@/lib/growth/automation/growth-automation-types"

function flowsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("automation_flows")
}

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("automation_flow_versions")
}

function nodesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("automation_nodes")
}

function edgesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("automation_edges")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function mapFlow(row: Record<string, unknown>): GrowthAutomationFlow {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name),
    description: asString(row.description),
    status: asString(row.status) as GrowthAutomationFlowStatus,
    currentVersionId: asString(row.current_version_id) || null,
    publishedVersionId: asString(row.published_version_id) || null,
    qaMarker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    archivedAt: asString(row.archived_at) || null,
  }
}

function mapVersion(row: Record<string, unknown>): GrowthAutomationFlowVersion {
  return {
    id: asString(row.id),
    flowId: asString(row.flow_id),
    versionNumber: asNumber(row.version_number, 1),
    lifecycle: asString(row.lifecycle) as GrowthAutomationVersionLifecycle,
    canvasLayoutJson: asRecord(row.canvas_layout_json),
    compiledPatternId: asString(row.compiled_pattern_id) || null,
    publishedAt: asString(row.published_at) || null,
    publishedBy: asString(row.published_by) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapNode(row: Record<string, unknown>): GrowthAutomationNode {
  return {
    id: asString(row.id),
    versionId: asString(row.version_id),
    nodeType: asString(row.node_type) as GrowthAutomationNodeType,
    label: asString(row.label),
    positionX: asNumber(row.position_x),
    positionY: asNumber(row.position_y),
    configJson: asRecord(row.config_json),
    validationState: asString(row.validation_state) as GrowthAutomationNodeValidationState,
    compiledPatternStepId: asString(row.compiled_pattern_step_id) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapEdge(row: Record<string, unknown>): GrowthAutomationEdge {
  return {
    id: asString(row.id),
    versionId: asString(row.version_id),
    fromNodeId: asString(row.from_node_id),
    toNodeId: asString(row.to_node_id),
    edgeType: asString(row.edge_type) as GrowthAutomationEdgeType,
    priority: asNumber(row.priority),
    conditionId: asString(row.condition_id) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

async function getFlowRowOrThrow(admin: SupabaseClient, flowId: string): Promise<GrowthAutomationFlow> {
  const { data, error } = await flowsTable(admin).select("*").eq("id", flowId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("automation_flow_not_found")
  return mapFlow(data as Record<string, unknown>)
}

async function getVersionRowOrThrow(
  admin: SupabaseClient,
  versionId: string,
): Promise<GrowthAutomationFlowVersion> {
  const { data, error } = await versionsTable(admin).select("*").eq("id", versionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("automation_version_not_found")
  return mapVersion(data as Record<string, unknown>)
}

function assertFlowOrgScope(flow: GrowthAutomationFlow, organizationId: string): void {
  if (flow.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
}

function assertDraftVersion(version: GrowthAutomationFlowVersion): void {
  if (!canEditAutomationDraftVersion(version.lifecycle)) throw new Error("version_not_editable")
}

export async function createFlow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    name: string
    description?: string
    canvasLayoutJson?: Record<string, unknown>
  },
): Promise<{ flow: GrowthAutomationFlow; version: GrowthAutomationFlowVersion }> {
  const { data: flowRow, error: flowError } = await flowsTable(admin)
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      status: "draft",
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
    })
    .select("*")
    .single()
  if (flowError || !flowRow) throw new Error(flowError?.message ?? "automation_flow_create_failed")

  const flow = mapFlow(flowRow as Record<string, unknown>)
  const { data: versionRow, error: versionError } = await versionsTable(admin)
    .insert({
      flow_id: flow.id,
      version_number: 1,
      lifecycle: "draft",
      canvas_layout_json: input.canvasLayoutJson ?? {},
    })
    .select("*")
    .single()
  if (versionError || !versionRow) throw new Error(versionError?.message ?? "automation_version_create_failed")

  const version = mapVersion(versionRow as Record<string, unknown>)
  const { error: updateError } = await flowsTable(admin)
    .update({ current_version_id: version.id })
    .eq("id", flow.id)
  if (updateError) throw new Error(updateError.message)

  return { flow: { ...flow, currentVersionId: version.id }, version }
}

export async function updateFlow(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    name?: string
    description?: string
    status?: GrowthAutomationFlowStatus
  },
): Promise<GrowthAutomationFlow> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (flow.status === "archived") throw new Error("automation_flow_archived")

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.status !== undefined) patch.status = input.status

  const { data, error } = await flowsTable(admin).update(patch).eq("id", flow.id).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "automation_flow_update_failed")
  return mapFlow(data as Record<string, unknown>)
}

export async function archiveFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationFlow> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (!canArchiveAutomationFlow(flow.status)) throw new Error("invalid_status_transition")

  const { data, error } = await flowsTable(admin)
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", flow.id)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "automation_flow_archive_failed")
  return mapFlow(data as Record<string, unknown>)
}

export async function listFlows(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthAutomationFlowStatus
    search?: string
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthAutomationFlow[]; total: number }> {
  let query = flowsTable(admin).select("*", { count: "exact" }).eq("organization_id", input.organizationId)
  if (input.status) query = query.eq("status", input.status)
  if (input.search?.trim()) query = query.ilike("name", `%${input.search.trim()}%`)

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)

  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(mapFlow),
    total: count ?? 0,
  }
}

export async function getFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationFlow> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  return flow
}

export async function createVersion(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    canvasLayoutJson?: Record<string, unknown>
  },
): Promise<GrowthAutomationFlowVersion> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (flow.status === "archived") throw new Error("automation_flow_archived")

  const { data: latest, error: latestError } = await versionsTable(admin)
    .select("version_number")
    .eq("flow_id", flow.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw new Error(latestError.message)

  const nextVersion = asNumber((latest as { version_number?: number } | null)?.version_number, 0) + 1
  const { data, error } = await versionsTable(admin)
    .insert({
      flow_id: flow.id,
      version_number: nextVersion,
      lifecycle: "draft",
      canvas_layout_json: input.canvasLayoutJson ?? {},
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "automation_version_create_failed")

  const version = mapVersion(data as Record<string, unknown>)
  await flowsTable(admin).update({ current_version_id: version.id }).eq("id", flow.id)
  return version
}

export async function listVersions(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationFlowVersion[]> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const { data, error } = await versionsTable(admin)
    .select("*")
    .eq("flow_id", flow.id)
    .order("version_number", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapVersion)
}

export async function publishVersionPlaceholder(
  admin: SupabaseClient,
  input: { flowId: string; versionId: string; organizationId: string; publishedBy?: string | null },
): Promise<{ flow: GrowthAutomationFlow; version: GrowthAutomationFlowVersion }> {
  const result = await publishAutomationFlowVersionMetadata(admin, {
    flowId: input.flowId,
    versionId: input.versionId,
    organizationId: input.organizationId,
    publishedBy: input.publishedBy ?? null,
    publishMetadata: {},
    canvasLayoutJson: {},
  })
  return { flow: result.flow, version: result.publishedVersion }
}

export async function cloneVersionGraph(
  admin: SupabaseClient,
  input: {
    sourceVersionId: string
    targetVersionId: string
  },
): Promise<void> {
  const sourceNodes = await listNodesForVersion(admin, input.sourceVersionId)
  const sourceEdges = await listEdgesForVersion(admin, input.sourceVersionId)
  const nodeIdMap = new Map<string, string>()

  for (const node of sourceNodes) {
    const { data, error } = await nodesTable(admin)
      .insert({
        version_id: input.targetVersionId,
        node_type: node.nodeType,
        label: node.label,
        position_x: node.positionX,
        position_y: node.positionY,
        config_json: node.configJson,
        validation_state: node.validationState,
      })
      .select("*")
      .single()
    if (error || !data) throw new Error(error?.message ?? "automation_node_clone_failed")
    nodeIdMap.set(node.id, asString((data as Record<string, unknown>).id))
  }

  for (const edge of sourceEdges) {
    const fromNodeId = nodeIdMap.get(edge.fromNodeId)
    const toNodeId = nodeIdMap.get(edge.toNodeId)
    if (!fromNodeId || !toNodeId) throw new Error("automation_edge_clone_failed")

    const { error } = await edgesTable(admin).insert({
      version_id: input.targetVersionId,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      edge_type: edge.edgeType,
      priority: edge.priority,
      condition_id: null,
    })
    if (error) throw new Error(error.message)
  }
}

async function supersedePublishedVersions(admin: SupabaseClient, flowId: string, keepVersionId: string): Promise<void> {
  const { error } = await versionsTable(admin)
    .update({ lifecycle: "superseded" })
    .eq("flow_id", flowId)
    .eq("lifecycle", "published")
    .neq("id", keepVersionId)
  if (error) throw new Error(error.message)
}

export async function publishAutomationFlowVersionMetadata(
  admin: SupabaseClient,
  input: {
    flowId: string
    versionId: string
    organizationId: string
    publishedBy?: string | null
    publishMetadata: Record<string, unknown>
    canvasLayoutJson: Record<string, unknown>
  },
): Promise<{
  flow: GrowthAutomationFlow
  publishedVersion: GrowthAutomationFlowVersion
  draftVersion: GrowthAutomationFlowVersion
}> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (flow.status === "archived") throw new Error("automation_flow_archived")

  const version = await getVersionRowOrThrow(admin, input.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  if (version.lifecycle !== "draft") throw new Error("version_not_draft")

  await supersedePublishedVersions(admin, flow.id, version.id)

  const publishedAt = new Date().toISOString()
  const { data: publishedRow, error: publishError } = await versionsTable(admin)
    .update({
      lifecycle: "published",
      published_at: publishedAt,
      published_by: input.publishedBy ?? null,
      canvas_layout_json: input.canvasLayoutJson,
      compiled_pattern_id: null,
    })
    .eq("id", version.id)
    .select("*")
    .single()
  if (publishError || !publishedRow) throw new Error(publishError?.message ?? "automation_version_publish_failed")

  const publishedVersion = mapVersion(publishedRow as Record<string, unknown>)

  const { data: latest, error: latestError } = await versionsTable(admin)
    .select("version_number")
    .eq("flow_id", flow.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw new Error(latestError.message)

  const nextVersionNumber = asNumber((latest as { version_number?: number } | null)?.version_number, 0) + 1
  const { data: draftRow, error: draftError } = await versionsTable(admin)
    .insert({
      flow_id: flow.id,
      version_number: nextVersionNumber,
      lifecycle: "draft",
      canvas_layout_json: {},
    })
    .select("*")
    .single()
  if (draftError || !draftRow) throw new Error(draftError?.message ?? "automation_draft_version_create_failed")

  const draftVersion = mapVersion(draftRow as Record<string, unknown>)
  await cloneVersionGraph(admin, {
    sourceVersionId: publishedVersion.id,
    targetVersionId: draftVersion.id,
  })

  const { data: flowRow, error: flowError } = await flowsTable(admin)
    .update({
      status: "published",
      published_version_id: publishedVersion.id,
      current_version_id: draftVersion.id,
    })
    .eq("id", flow.id)
    .select("*")
    .single()
  if (flowError || !flowRow) throw new Error(flowError?.message ?? "automation_flow_publish_failed")

  return {
    flow: mapFlow(flowRow as Record<string, unknown>),
    publishedVersion,
    draftVersion,
  }
}

export async function unpublishAutomationFlowMetadata(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationFlow> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (flow.status !== "published") throw new Error("flow_not_published")

  const { data, error } = await flowsTable(admin)
    .update({ status: "draft" })
    .eq("id", flow.id)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "automation_flow_unpublish_failed")
  return mapFlow(data as Record<string, unknown>)
}

export async function createDraftFromPublishedVersionMetadata(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ flow: GrowthAutomationFlow; version: GrowthAutomationFlowVersion }> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  if (flow.status === "archived") throw new Error("automation_flow_archived")
  if (!flow.publishedVersionId) throw new Error("no_published_version")

  if (flow.currentVersionId) {
    const current = await getVersionRowOrThrow(admin, flow.currentVersionId)
    if (current.lifecycle === "draft") {
      return { flow, version: current }
    }
  }

  const published = await getVersionRowOrThrow(admin, flow.publishedVersionId)
  const { data: latest, error: latestError } = await versionsTable(admin)
    .select("version_number")
    .eq("flow_id", flow.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestError) throw new Error(latestError.message)

  const nextVersionNumber = asNumber((latest as { version_number?: number } | null)?.version_number, 0) + 1
  const { data: draftRow, error: draftError } = await versionsTable(admin)
    .insert({
      flow_id: flow.id,
      version_number: nextVersionNumber,
      lifecycle: "draft",
      canvas_layout_json: published.canvasLayoutJson,
    })
    .select("*")
    .single()
  if (draftError || !draftRow) throw new Error(draftError?.message ?? "automation_draft_version_create_failed")

  const draftVersion = mapVersion(draftRow as Record<string, unknown>)
  await cloneVersionGraph(admin, {
    sourceVersionId: published.id,
    targetVersionId: draftVersion.id,
  })

  const { data: flowRow, error: flowError } = await flowsTable(admin)
    .update({ current_version_id: draftVersion.id })
    .eq("id", flow.id)
    .select("*")
    .single()
  if (flowError || !flowRow) throw new Error(flowError?.message ?? "automation_flow_update_failed")

  return { flow: mapFlow(flowRow as Record<string, unknown>), version: draftVersion }
}

export async function listNodesForVersion(
  admin: SupabaseClient,
  versionId: string,
): Promise<GrowthAutomationNode[]> {
  const { data, error } = await nodesTable(admin).select("*").eq("version_id", versionId).order("created_at")
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapNode)
}

export async function listEdgesForVersion(
  admin: SupabaseClient,
  versionId: string,
): Promise<GrowthAutomationEdge[]> {
  const { data, error } = await edgesTable(admin)
    .select("*")
    .eq("version_id", versionId)
    .order("priority", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapEdge)
}

export async function createNode(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    versionId?: string
    nodeType: GrowthAutomationNodeType
    label?: string
    positionX?: number
    positionY?: number
    configJson?: Record<string, unknown>
  },
): Promise<GrowthAutomationNode> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  const versionId = input.versionId ?? flow.currentVersionId
  if (!versionId) throw new Error("automation_version_not_found")
  const version = await getVersionRowOrThrow(admin, versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  const { data, error } = await nodesTable(admin)
    .insert({
      version_id: version.id,
      node_type: input.nodeType,
      label: input.label?.trim() ?? "",
      position_x: input.positionX ?? 0,
      position_y: input.positionY ?? 0,
      config_json: input.configJson ?? {},
      validation_state: "pending",
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "automation_node_create_failed")
  return mapNode(data as Record<string, unknown>)
}

export async function updateNode(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    nodeId: string
    label?: string
    positionX?: number
    positionY?: number
    configJson?: Record<string, unknown>
    validationState?: GrowthAutomationNodeValidationState
  },
): Promise<GrowthAutomationNode> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const { data: nodeRow, error: nodeError } = await nodesTable(admin).select("*").eq("id", input.nodeId).maybeSingle()
  if (nodeError) throw new Error(nodeError.message)
  if (!nodeRow) throw new Error("automation_node_not_found")

  const node = mapNode(nodeRow as Record<string, unknown>)
  const version = await getVersionRowOrThrow(admin, node.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  const patch: Record<string, unknown> = {}
  if (input.label !== undefined) patch.label = input.label.trim()
  if (input.positionX !== undefined) patch.position_x = input.positionX
  if (input.positionY !== undefined) patch.position_y = input.positionY
  if (input.configJson !== undefined) patch.config_json = input.configJson
  if (input.validationState !== undefined) patch.validation_state = input.validationState

  const { data, error } = await nodesTable(admin).update(patch).eq("id", node.id).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "automation_node_update_failed")
  return mapNode(data as Record<string, unknown>)
}

export async function deleteNode(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; nodeId: string },
): Promise<void> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const { data: nodeRow, error: nodeError } = await nodesTable(admin).select("*").eq("id", input.nodeId).maybeSingle()
  if (nodeError) throw new Error(nodeError.message)
  if (!nodeRow) throw new Error("automation_node_not_found")

  const node = mapNode(nodeRow as Record<string, unknown>)
  const version = await getVersionRowOrThrow(admin, node.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  await edgesTable(admin).delete().or(`from_node_id.eq.${node.id},to_node_id.eq.${node.id}`)
  const { error } = await nodesTable(admin).delete().eq("id", node.id)
  if (error) throw new Error(error.message)
}

export async function createEdge(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    versionId?: string
    fromNodeId: string
    toNodeId: string
    edgeType?: GrowthAutomationEdgeType
    priority?: number
    conditionId?: string | null
  },
): Promise<GrowthAutomationEdge> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  const versionId = input.versionId ?? flow.currentVersionId
  if (!versionId) throw new Error("automation_version_not_found")
  const version = await getVersionRowOrThrow(admin, versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  const { data, error } = await edgesTable(admin)
    .insert({
      version_id: version.id,
      from_node_id: input.fromNodeId,
      to_node_id: input.toNodeId,
      edge_type: input.edgeType ?? "default",
      priority: input.priority ?? 0,
      condition_id: input.conditionId ?? null,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "automation_edge_create_failed")
  return mapEdge(data as Record<string, unknown>)
}

export async function updateEdge(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    edgeId: string
    edgeType?: GrowthAutomationEdgeType
    priority?: number
    conditionId?: string | null
  },
): Promise<GrowthAutomationEdge> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const { data: edgeRow, error: edgeError } = await edgesTable(admin).select("*").eq("id", input.edgeId).maybeSingle()
  if (edgeError) throw new Error(edgeError.message)
  if (!edgeRow) throw new Error("automation_edge_not_found")

  const edge = mapEdge(edgeRow as Record<string, unknown>)
  const version = await getVersionRowOrThrow(admin, edge.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  const patch: Record<string, unknown> = {}
  if (input.edgeType !== undefined) patch.edge_type = input.edgeType
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.conditionId !== undefined) patch.condition_id = input.conditionId

  const { data, error } = await edgesTable(admin).update(patch).eq("id", edge.id).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "automation_edge_update_failed")
  return mapEdge(data as Record<string, unknown>)
}

export async function deleteEdge(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; edgeId: string },
): Promise<void> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const { data: edgeRow, error: edgeError } = await edgesTable(admin).select("*").eq("id", input.edgeId).maybeSingle()
  if (edgeError) throw new Error(edgeError.message)
  if (!edgeRow) throw new Error("automation_edge_not_found")

  const edge = mapEdge(edgeRow as Record<string, unknown>)
  const version = await getVersionRowOrThrow(admin, edge.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")
  assertDraftVersion(version)

  const { error } = await edgesTable(admin).delete().eq("id", edge.id)
  if (error) throw new Error(error.message)
}

export async function getFlowGraph(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string; versionId?: string },
): Promise<{
  flow: GrowthAutomationFlow
  version: GrowthAutomationFlowVersion
  nodes: GrowthAutomationNode[]
  edges: GrowthAutomationEdge[]
}> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  const versionId = input.versionId ?? flow.currentVersionId
  if (!versionId) throw new Error("automation_version_not_found")
  const version = await getVersionRowOrThrow(admin, versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")

  const [nodes, edges] = await Promise.all([
    listNodesForVersion(admin, version.id),
    listEdgesForVersion(admin, version.id),
  ])
  return { flow, version, nodes, edges }
}

export async function linkAutomationRuntimePublish(
  admin: SupabaseClient,
  input: {
    flowId: string
    versionId: string
    organizationId: string
    patternId: string
    canvasLayoutJson: Record<string, unknown>
    nodeStepLinks: Array<{ nodeId: string; patternStepId: string }>
    edgeConditionLinks: Array<{ edgeId: string; conditionId: string | null }>
  },
): Promise<{ flow: GrowthAutomationFlow; version: GrowthAutomationFlowVersion }> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)

  const version = await getVersionRowOrThrow(admin, input.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")

  const { data: versionRow, error: versionError } = await versionsTable(admin)
    .update({
      compiled_pattern_id: input.patternId,
      canvas_layout_json: input.canvasLayoutJson,
    })
    .eq("id", version.id)
    .select("*")
    .single()
  if (versionError || !versionRow) throw new Error(versionError?.message ?? "runtime_publish_version_update_failed")

  for (const link of input.nodeStepLinks) {
    const { error } = await nodesTable(admin)
      .update({ compiled_pattern_step_id: link.patternStepId })
      .eq("id", link.nodeId)
      .eq("version_id", version.id)
    if (error) throw new Error(error.message)
  }

  for (const link of input.edgeConditionLinks) {
    if (!link.conditionId) continue
    const { error } = await edgesTable(admin)
      .update({ condition_id: link.conditionId })
      .eq("id", link.edgeId)
      .eq("version_id", version.id)
    if (error) throw new Error(error.message)
  }

  return {
    flow,
    version: mapVersion(versionRow as Record<string, unknown>),
  }
}

export async function updateAutomationRuntimeMetadata(
  admin: SupabaseClient,
  input: {
    flowId: string
    versionId: string
    organizationId: string
    canvasLayoutJson: Record<string, unknown>
  },
): Promise<GrowthAutomationFlowVersion> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  const version = await getVersionRowOrThrow(admin, input.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")

  const { data, error } = await versionsTable(admin)
    .update({ canvas_layout_json: input.canvasLayoutJson })
    .eq("id", version.id)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "runtime_metadata_update_failed")
  return mapVersion(data as Record<string, unknown>)
}

export async function clearAutomationRuntimePublish(
  admin: SupabaseClient,
  input: {
    flowId: string
    versionId: string
    organizationId: string
    canvasLayoutJson: Record<string, unknown>
  },
): Promise<GrowthAutomationFlowVersion> {
  const flow = await getFlowRowOrThrow(admin, input.flowId)
  assertFlowOrgScope(flow, input.organizationId)
  const version = await getVersionRowOrThrow(admin, input.versionId)
  if (version.flowId !== flow.id) throw new Error("version_flow_mismatch")

  const { data, error } = await versionsTable(admin)
    .update({
      compiled_pattern_id: null,
      canvas_layout_json: input.canvasLayoutJson,
    })
    .eq("id", version.id)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "runtime_publish_clear_failed")

  await nodesTable(admin)
    .update({ compiled_pattern_step_id: null })
    .eq("version_id", version.id)

  return mapVersion(data as Record<string, unknown>)
}
