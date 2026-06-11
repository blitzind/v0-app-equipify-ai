import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildOpportunityDraftFunnelMetrics } from "@/lib/growth/meeting-intelligence/opportunity-draft-funnel-metrics"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const metrics = await buildOpportunityDraftFunnelMetrics(access.admin)
  return NextResponse.json(metrics)
}
