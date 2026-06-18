import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildSequencePreviewReadinessPayload } from "@/lib/growth/sequence-preview/sequence-preview-route-gates"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("sequencePreviewStudio", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildSequencePreviewReadinessPayload(),
  })
}
