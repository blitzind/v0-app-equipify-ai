import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { growthHomeNoStoreJson } from "@/lib/growth/home/growth-home-no-store-response"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER } from "@/lib/growth/home/growth-home-workspace-summary-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GE-SIMPLIFY-1B — Canonical Home / AI OS workspace read model. */
export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const summary = await buildGrowthHomeWorkspaceSummary({
      admin: access.admin,
      operatorEmail: access.userEmail,
      actorUserId: access.userId,
    })
    return growthHomeNoStoreJson(summary)
  } catch (error) {
    return growthHomeNoStoreJson(
      {
        ok: false,
        qaMarker: GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER,
        error: "growth_home_workspace_summary_failed",
        message: error instanceof Error ? error.message : "Could not load Home workspace summary.",
      },
      { status: 500 },
    )
  }
}
