import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildProspectDiscoveryReadinessPayload } from "@/lib/growth/prospect-discovery/prospect-search-certification"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json(buildProspectDiscoveryReadinessPayload())
}
