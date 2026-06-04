import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadSocialProfileDiscoveryRunDetail } from "@/lib/growth/social-profile-discovery/social-profile-discovery-repository"
import { isGrowthSocialProfileDiscoverySchemaReady } from "@/lib/growth/social-profile-discovery/social-profile-discovery-schema-health"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const run_id = runId?.trim() ?? ""
  if (!run_id) {
    return NextResponse.json({ ok: false, error: "validation_error", message: "runId is required." }, { status: 400 })
  }

  if (!(await isGrowthSocialProfileDiscoverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION,
      },
      { status: 503 },
    )
  }

  const detail = await loadSocialProfileDiscoveryRunDetail(access.admin, run_id)
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Run not found." }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
    detail,
  })
}
