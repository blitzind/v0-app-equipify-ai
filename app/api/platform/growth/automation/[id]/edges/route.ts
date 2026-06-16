import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createEdge,
  deleteEdge,
  getFlowGraph,
  updateEdge,
} from "@/lib/growth/automation/growth-automation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import {
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  GROWTH_AUTOMATION_EDGE_TYPES,
} from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
  edge_type: z.enum(GROWTH_AUTOMATION_EDGE_TYPES).optional(),
  priority: z.number().int().min(0).optional(),
  condition_id: z.string().uuid().nullable().optional(),
  version_id: z.string().uuid().optional(),
})

const PatchSchema = z.object({
  edge_id: z.string().uuid(),
  delete: z.boolean().optional(),
  edge_type: z.enum(GROWTH_AUTOMATION_EDGE_TYPES).optional(),
  priority: z.number().int().min(0).optional(),
  condition_id: z.string().uuid().nullable().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const graph = await getFlowGraph(access.admin, { flowId: id, organizationId: access.organizationId })
    return NextResponse.json({
      ok: true,
      edges: graph.edges,
      version: graph.version,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const edge = await createEdge(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      versionId: parsed.data.version_id,
      fromNodeId: parsed.data.from_node_id,
      toNodeId: parsed.data.to_node_id,
      edgeType: parsed.data.edge_type,
      priority: parsed.data.priority,
      conditionId: parsed.data.condition_id,
    })
    return NextResponse.json({
      ok: true,
      edge,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    if (parsed.data.delete) {
      await deleteEdge(access.admin, {
        flowId: id,
        organizationId: access.organizationId,
        edgeId: parsed.data.edge_id,
      })
      return NextResponse.json({
        ok: true,
        deleted: true,
        edge_id: parsed.data.edge_id,
        qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
        ...automationApiSafetyPayload(),
      })
    }

    const edge = await updateEdge(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      edgeId: parsed.data.edge_id,
      edgeType: parsed.data.edge_type,
      priority: parsed.data.priority,
      conditionId: parsed.data.condition_id,
    })
    return NextResponse.json({
      ok: true,
      edge,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
