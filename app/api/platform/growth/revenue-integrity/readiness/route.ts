import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildRevenueIntegrityReadiness } from "@/lib/growth/revenue-integrity/revenue-integrity-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildRevenueIntegrityReadiness(access.admin)
  return NextResponse.json(payload)
}
