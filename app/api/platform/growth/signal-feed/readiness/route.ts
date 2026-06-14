import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildSignalFeedReadiness } from "@/lib/growth/signal-intelligence/signal-feed-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildSignalFeedReadiness(access.admin)
  return NextResponse.json(payload)
}
