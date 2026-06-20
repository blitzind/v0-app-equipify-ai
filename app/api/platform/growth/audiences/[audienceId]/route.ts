import { NextResponse } from "next/server"
import {
  getGrowthAudience,
  listGrowthAudienceRefreshRuns,
  listGrowthAudienceSnapshots,
  updateGrowthAudienceRefreshPolicy,
} from "@/lib/growth/audiences/growth-audience-repository"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import {
  GROWTH_AUDIENCE_QA_MARKER,
  GROWTH_AUDIENCE_REFRESH_POLICIES,
  normalizeAudienceRefreshPolicy,
} from "@/lib/growth/audiences/growth-audience-config"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ audienceId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const [snapshots, refreshRuns] = await Promise.all([
      listGrowthAudienceSnapshots(access.admin, { audienceId, limit: 10 }),
      listGrowthAudienceRefreshRuns(access.admin, { audienceId, limit: 10 }),
    ])

    return NextResponse.json({
      ok: true,
      audience,
      snapshots,
      refreshRuns,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "load_failed" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const body = (await request.json()) as { refreshPolicy?: string }
    const refreshPolicy = normalizeAudienceRefreshPolicy(body.refreshPolicy)
    if (!GROWTH_AUDIENCE_REFRESH_POLICIES.includes(refreshPolicy)) {
      return NextResponse.json({ ok: false, message: "invalid_refresh_policy" }, { status: 400 })
    }

    const updated = await updateGrowthAudienceRefreshPolicy(access.admin, {
      audienceId,
      refreshPolicy,
    })

    return NextResponse.json({
      ok: true,
      audience: updated,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "update_failed" },
      { status: 500 },
    )
  }
}
