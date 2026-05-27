import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listOpportunitySignals } from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { isGrowthOpportunityIntelligenceSchemaReady } from "@/lib/growth/opportunity-intelligence/schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthOpportunityIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const leadId = new URL(request.url).searchParams.get("leadId") ?? undefined
  try {
    const signals = await listOpportunitySignals(access.admin, { leadId, limit: 100 })
    return NextResponse.json({ ok: true, signals })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load opportunity signals." }, { status: 500 })
  }
}
