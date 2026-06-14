import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildSignalIntelligenceReadiness } from "@/lib/growth/signal-intelligence/signal-intelligence-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildSignalIntelligenceReadiness(access.admin)
  return NextResponse.json(payload)
}
