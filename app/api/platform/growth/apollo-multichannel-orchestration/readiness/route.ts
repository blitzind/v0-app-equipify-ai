import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloMultichannelOrchestrationReadiness } from "@/lib/growth/apollo/apollo-multichannel-orchestration-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloMultichannelOrchestrationReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
