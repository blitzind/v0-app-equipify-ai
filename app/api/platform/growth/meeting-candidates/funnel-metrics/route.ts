import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloMeetingCandidateFunnelMetrics } from "@/lib/growth/apollo/apollo-meeting-candidates-funnel-metrics"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const metrics = await buildApolloMeetingCandidateFunnelMetrics(access.admin)
  return NextResponse.json(metrics)
}
