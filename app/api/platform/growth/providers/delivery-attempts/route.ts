import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthLiveProviderTransportSchemaReady } from "@/lib/growth/providers/transport/transport-schema-health"
import { listDeliveryAttempts } from "@/lib/growth/providers/transport/transport-repository"
import { GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE } from "@/lib/growth/providers/adapters/provider-adapter-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthLiveProviderTransportSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270408120000_growth_live_provider_transport.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
  const status = url.searchParams.get("status") ?? undefined
  const providerId = url.searchParams.get("providerId") ?? undefined

  try {
    const attempts = await listDeliveryAttempts(access.admin, {
      limit: Number.isFinite(limit) ? Math.min(limit, 200) : 50,
      status,
      provider_id: providerId,
    })

    return NextResponse.json({
      ok: true,
      attempts,
      privacy_note: GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "delivery_attempts_failed",
        message: error instanceof Error ? error.message : "Could not load delivery attempts.",
      },
      { status: 500 },
    )
  }
}
