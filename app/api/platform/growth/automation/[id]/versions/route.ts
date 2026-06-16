import { NextResponse } from "next/server"
import { z } from "zod"
import { createVersion, listVersions } from "@/lib/growth/automation/growth-automation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  canvas_layout_json: z.record(z.unknown()).optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const versions = await listVersions(access.admin, { flowId: id, organizationId: access.organizationId })
    return NextResponse.json({
      ok: true,
      items: versions,
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
    const version = await createVersion(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      canvasLayoutJson: parsed.data.canvas_layout_json,
    })
    return NextResponse.json({
      ok: true,
      version,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      ...automationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
