import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildCampaignBuilderReadinessPayload } from "@/lib/growth/campaign-builder/campaign-builder-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildCampaignBuilderReadinessPayload(),
  })
}
