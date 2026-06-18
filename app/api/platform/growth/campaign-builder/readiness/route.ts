import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildCampaignBuilderReadinessPayload } from "@/lib/growth/campaign-builder/campaign-builder-route-gates"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("campaignBuilder", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildCampaignBuilderReadinessPayload(),
  })
}
