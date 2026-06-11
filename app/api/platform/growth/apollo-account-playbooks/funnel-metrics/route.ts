import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloAccountPlaybookFunnelMetrics } from "@/lib/growth/apollo/apollo-account-playbooks-funnel-metrics"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const metrics = await buildApolloAccountPlaybookFunnelMetrics(access.admin)
  return NextResponse.json(metrics)
}
