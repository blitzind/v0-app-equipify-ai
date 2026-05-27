import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchDeliverabilityOverview } from "@/lib/growth/deliverability/deliverability-repository"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"
import { GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE } from "@/lib/growth/deliverability/deliverability-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDnsDeliverabilitySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270126120000_growth_dns_deliverability.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const overview = await fetchDeliverabilityOverview(access.admin)
    return NextResponse.json({
      ok: true,
      ...overview,
      privacy_note: GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "deliverability_overview_failed",
        message: error instanceof Error ? error.message : "Could not load deliverability overview.",
      },
      { status: 500 },
    )
  }
}
