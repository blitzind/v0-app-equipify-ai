import { NextResponse } from "next/server"
import { z } from "zod"
import {
  archiveFlow,
  getFlowGraph,
  updateFlow,
} from "@/lib/growth/automation/growth-automation-service"
import {
  assertAutomationFlowOrgScope,
  requireAutomationPlatformAccess,
} from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import {
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
  GROWTH_AUTOMATION_FLOW_STATUSES,
} from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(GROWTH_AUTOMATION_FLOW_STATUSES).optional(),
  archive: z.boolean().optional(),
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
      flow: graph.flow,
      version: graph.version,
      nodes: graph.nodes,
      edges: graph.edges,
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
    if (parsed.data.archive) {
      const flow = await archiveFlow(access.admin, { flowId: id, organizationId: access.organizationId })
      return NextResponse.json({
        ok: true,
        flow,
        qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
        ...automationApiSafetyPayload(),
      })
    }

    const flow = await updateFlow(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
    })
    const scopeError = assertAutomationFlowOrgScope(flow, access.organizationId)
    if (scopeError) return scopeError

    return NextResponse.json({
      ok: true,
      flow,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
