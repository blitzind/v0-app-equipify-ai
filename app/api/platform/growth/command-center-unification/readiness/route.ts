import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildCommandCenterUnificationReadinessPayload } from "@/lib/growth/command-center-unification/command-center-unification-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildCommandCenterUnificationReadinessPayload(),
  })
}
