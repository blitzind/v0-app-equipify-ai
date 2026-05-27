import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchProviderDeliveryDashboard } from "@/lib/growth/providers/provider-repository"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"
import { GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE } from "@/lib/growth/providers/provider-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270130120000_growth_provider_delivery.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const payload = await fetchProviderDeliveryDashboard(access.admin)
    return NextResponse.json({
      ok: true,
      ...payload,
      privacy_note: GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "delivery_dashboard_failed",
        message: error instanceof Error ? error.message : "Could not load delivery dashboard.",
      },
      { status: 500 },
    )
  }
}
