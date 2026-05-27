import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listOpportunityRecommendations } from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { isGrowthOpportunityIntelligenceSchemaReady } from "@/lib/growth/opportunity-intelligence/schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthOpportunityIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined
  const status = url.searchParams.get("status") as "pending" | "accepted" | "dismissed" | "expired" | null

  try {
    const recommendations = await listOpportunityRecommendations(access.admin, {
      leadId,
      status: status ?? undefined,
      limit: 100,
    })
    return NextResponse.json({ ok: true, recommendations })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load recommendations." }, { status: 500 })
  }
}
