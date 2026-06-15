import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyProspectRecommendationAction } from "@/lib/growth/prospect-discovery/prospect-recommendation-repository"
import {
  PROSPECT_RECOMMENDATION_ACTIONS,
  type ProspectRecommendationActionType,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"

export const runtime = "nodejs"
export const maxDuration = 60

function validateActionBody(body: unknown): {
  ok: boolean
  audit_event_id?: string
  action?: ProspectRecommendationActionType
  error?: string
} {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" }
  }
  const record = body as Record<string, unknown>
  const audit_event_id = typeof record.audit_event_id === "string" ? record.audit_event_id.trim() : ""
  const action = typeof record.action === "string" ? record.action.trim() : ""
  if (!audit_event_id) return { ok: false, error: "audit_event_id_required" }
  if (!PROSPECT_RECOMMENDATION_ACTIONS.includes(action as ProspectRecommendationActionType)) {
    return { ok: false, error: "invalid_action" }
  }
  return { ok: true, audit_event_id, action: action as ProspectRecommendationActionType }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const parsed = validateActionBody(body)
  if (!parsed.ok || !parsed.audit_event_id || !parsed.action) {
    return NextResponse.json(
      { ok: false, error: "invalid_action", message: parsed.error },
      { status: 400 },
    )
  }

  const result = await applyProspectRecommendationAction(access.admin, {
    audit_event_id: parsed.audit_event_id,
    action: parsed.action,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "update_failed" },
      { status: result.error === "not_found" ? 404 : 422 },
    )
  }

  return NextResponse.json({
    ok: true,
    audit_event_id: parsed.audit_event_id,
    status: result.status,
    enrollment_enabled: false,
    outreach_enabled: false,
    requires_human_approval: true,
  })
}
