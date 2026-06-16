import { NextResponse } from "next/server"
import { getAutomationRuntimeReconciliation } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationRuntimeReconciliationApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const candidateVersionId = new URL(request.url).searchParams.get("version_id") ?? undefined

  try {
    const reconciliation = await getAutomationRuntimeReconciliation(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      candidateVersionId,
    })

    return NextResponse.json({
      ok: reconciliation.status === "previewed" || reconciliation.status === "blocked",
      reconciliation,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      runtime_reconciliation_qa_marker: GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationRuntimeReconciliationApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
