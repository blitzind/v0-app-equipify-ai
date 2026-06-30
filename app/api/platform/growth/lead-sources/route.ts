import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthLeadSourceRegistry } from "@/lib/growth/lead-sources/lead-source-registry"
import { diagnoseDatamoonProvider } from "@/lib/growth/providers/datamoon"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    sources: listGrowthLeadSourceRegistry(),
    datamoon: diagnoseDatamoonProvider(),
  })
}
