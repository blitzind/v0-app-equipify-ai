import { NextResponse } from "next/server"
import {
  createGrowthObjectiveWithPlan,
  loadGrowthObjectiveDashboard,
} from "@/lib/growth/objectives/growth-objective-service"
import { GROWTH_OBJECTIVE_QA_MARKER, GROWTH_OBJECTIVE_TYPES } from "@/lib/growth/objectives/growth-objective-types"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError("organization_missing", "Organization not configured.", 503)
  }

  try {
    const dashboard = await loadGrowthObjectiveDashboard(access.admin, access.organizationId)
    return NextResponse.json({ ok: true, qa_marker: GROWTH_OBJECTIVE_QA_MARKER, dashboard })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load objectives."
    return growthWorkspaceSettingsJsonError("objectives_load_failed", message, 500)
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError("organization_missing", "Organization not configured.", 503)
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return growthWorkspaceSettingsJsonError("invalid_json", "Request body must be JSON.", 400)
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  const objectiveType = typeof body.objectiveType === "string" ? body.objectiveType : ""
  const targetValue = Number(body.targetValue)

  if (!title) {
    return growthWorkspaceSettingsJsonError("invalid_objective", "Title is required.", 400)
  }
  if (!(GROWTH_OBJECTIVE_TYPES as readonly string[]).includes(objectiveType)) {
    return growthWorkspaceSettingsJsonError("invalid_objective", "Invalid objective type.", 400)
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return growthWorkspaceSettingsJsonError("invalid_objective", "Target value must be positive.", 400)
  }

  try {
    const result = await createGrowthObjectiveWithPlan(access.admin, access.organizationId, {
      title,
      description: typeof body.description === "string" ? body.description : null,
      objectiveType: objectiveType as (typeof GROWTH_OBJECTIVE_TYPES)[number],
      targetValue,
      targetDate: typeof body.targetDate === "string" ? body.targetDate : null,
      ownerUserId: access.userId,
      priority: body.priority === "low" || body.priority === "medium" || body.priority === "critical" ? body.priority : "high",
      autonomyLevel: "objective",
      safetyMode: body.safetyMode === "balanced" || body.safetyMode === "shadow" ? body.safetyMode : "strict",
    }, { certificationMode: true, autoStart: true })
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
      objective: result.objective,
      orchestration: result.orchestration,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create objective."
    return growthWorkspaceSettingsJsonError("objective_create_failed", message, 500)
  }
}
