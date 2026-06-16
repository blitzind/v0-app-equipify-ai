import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createNode,
  deleteNode,
  getFlowGraph,
  updateNode,
} from "@/lib/growth/automation/growth-automation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import {
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  GROWTH_AUTOMATION_NODE_TYPES,
  GROWTH_AUTOMATION_NODE_VALIDATION_STATES,
} from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  node_type: z.enum(GROWTH_AUTOMATION_NODE_TYPES),
  label: z.string().max(160).optional(),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
  config_json: z.record(z.unknown()).optional(),
  version_id: z.string().uuid().optional(),
})

const PatchSchema = z.object({
  node_id: z.string().uuid(),
  delete: z.boolean().optional(),
  label: z.string().max(160).optional(),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
  config_json: z.record(z.unknown()).optional(),
  validation_state: z.enum(GROWTH_AUTOMATION_NODE_VALIDATION_STATES).optional(),
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
      nodes: graph.nodes,
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
    const node = await createNode(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      versionId: parsed.data.version_id,
      nodeType: parsed.data.node_type,
      label: parsed.data.label,
      positionX: parsed.data.position_x,
      positionY: parsed.data.position_y,
      configJson: parsed.data.config_json,
    })
    return NextResponse.json({
      ok: true,
      node,
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
      await deleteNode(access.admin, {
        flowId: id,
        organizationId: access.organizationId,
        nodeId: parsed.data.node_id,
      })
      return NextResponse.json({
        ok: true,
        deleted: true,
        node_id: parsed.data.node_id,
        qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
        ...automationApiSafetyPayload(),
      })
    }

    const node = await updateNode(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      nodeId: parsed.data.node_id,
      label: parsed.data.label,
      positionX: parsed.data.position_x,
      positionY: parsed.data.position_y,
      configJson: parsed.data.config_json,
      validationState: parsed.data.validation_state,
    })
    return NextResponse.json({
      ok: true,
      node,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
