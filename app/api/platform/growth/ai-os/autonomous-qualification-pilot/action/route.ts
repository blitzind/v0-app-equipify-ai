import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GE-AIOS-GROWTH-5C — Pilot control writes are owned by Growth Autonomy only. */
export async function POST() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  void getGrowthEngineAiOrgId()

  return NextResponse.json(
    {
      ok: false,
      qaMarker: GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER,
      error: "policy_control_plane_required",
      message: "Qualification pilot control is configured in Growth Autonomy — this endpoint is read-only.",
      configureHref: GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
    },
    { status: 403 },
  )
}
