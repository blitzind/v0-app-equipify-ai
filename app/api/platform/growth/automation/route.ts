import { NextResponse } from "next/server"
import { z } from "zod"
import { createFlow, listFlows } from "@/lib/growth/automation/growth-automation-service"
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

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  canvas_layout_json: z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && (GROWTH_AUTOMATION_FLOW_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof GROWTH_AUTOMATION_FLOW_STATUSES)[number])
      : undefined

  try {
    const result = await listFlows(access.admin, {
      organizationId: access.organizationId,
      status,
      search: url.searchParams.get("search") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })
    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const created = await createFlow(access.admin, {
      organizationId: access.organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
      canvasLayoutJson: parsed.data.canvas_layout_json,
    })
    return NextResponse.json({
      ok: true,
      flow: created.flow,
      version: created.version,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
