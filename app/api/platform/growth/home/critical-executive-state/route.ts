import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { growthHomeNoStoreJson } from "@/lib/growth/home/growth-home-no-store-response"
import { buildGrowthHomeCriticalExecutiveState } from "@/lib/growth/home/growth-home-critical-executive-state-server-2b-1c"
import {
  AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
  type GrowthHomeCriticalExecutiveStateErrorPayload,
} from "@/lib/growth/home/growth-home-critical-executive-state-2b-1c"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** AVA-GROWTH-HOTFIX-2B-1C — Minimal Home critical executive read model. */
export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const requestGeneration = Number.parseInt(url.searchParams.get("g") ?? "", 10)
  const retryAttempt = Number.parseInt(url.searchParams.get("retry") ?? "", 10)

  try {
    const payload = await buildGrowthHomeCriticalExecutiveState({
      admin: access.admin,
      actorUserId: access.userId,
      requestGeneration: Number.isFinite(requestGeneration) ? requestGeneration : null,
      retryAttempt: Number.isFinite(retryAttempt) ? retryAttempt : null,
    })
    return growthHomeNoStoreJson(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Home critical executive state."
    const body: GrowthHomeCriticalExecutiveStateErrorPayload = {
      ok: false,
      qaMarker: AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
      errorCode: "growth_home_critical_executive_state_failed",
      message,
      retryable: true,
      requestGeneration: Number.isFinite(requestGeneration) ? requestGeneration : null,
    }
    return growthHomeNoStoreJson(body, { status: 500 })
  }
}
