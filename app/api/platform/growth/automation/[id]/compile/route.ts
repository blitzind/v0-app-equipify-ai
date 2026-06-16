import { NextResponse } from "next/server"
import { compileAutomationFlowPreview } from "@/lib/growth/automation/growth-automation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationCompileApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import {
  GROWTH_AUTOMATION_COMPILER_QA_MARKER,
} from "@/lib/growth/automation/growth-automation-compiler-types"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runCompilePreview(request, context)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return runCompilePreview(request, context)
}

async function runCompilePreview(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const versionId = new URL(request.url).searchParams.get("version_id") ?? undefined

  try {
    const compile = await compileAutomationFlowPreview(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      versionId: versionId ?? undefined,
    })
    return NextResponse.json({
      ok: compile.status === "compiled",
      compile,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      compiler_qa_marker: GROWTH_AUTOMATION_COMPILER_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationCompileApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
