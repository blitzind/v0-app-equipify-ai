import { NextResponse } from "next/server"
import {
  fetchGrowthPriorityEngineBindingReadModel,
  findObjectivePriorityBindingContext,
} from "@/lib/growth/aios/priority/growth-priority-engine-binding-service"
import { GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import { GROWTH_OBJECTIVE_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response
  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError("organization_missing", "Organization not configured.", 503)
  }

  const url = new URL(request.url)
  const objectiveId = url.searchParams.get("objectiveId")

  try {
    const priorityBinding = await fetchGrowthPriorityEngineBindingReadModel(access.admin, {
      organizationId: access.organizationId,
    })
    const objectiveContext = objectiveId
      ? findObjectivePriorityBindingContext(priorityBinding, objectiveId)
      : null

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
      qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
      priorityBinding,
      objectiveContext,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load priority bindings."
    return growthWorkspaceSettingsJsonError("priority_binding_load_failed", message, 500)
  }
}
