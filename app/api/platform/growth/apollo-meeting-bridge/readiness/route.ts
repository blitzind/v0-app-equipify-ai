import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloMeetingBridgeReadiness } from "@/lib/growth/apollo/apollo-meeting-bridge-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloMeetingBridgeReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
