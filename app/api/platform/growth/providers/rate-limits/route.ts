import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthLiveProviderTransportSchemaReady } from "@/lib/growth/providers/transport/transport-schema-health"
import { listProviderRateLimits } from "@/lib/growth/providers/transport/transport-repository"
import { checkTransportRateLimit } from "@/lib/growth/providers/transport/transport-rate-limit"
import { GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE } from "@/lib/growth/providers/adapters/provider-adapter-types"

export const runtime = "nodejs"

export async function GET() {
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

  try {
    const rateLimits = await listProviderRateLimits(access.admin)
    const enriched = rateLimits.map((row) => ({
      ...row,
      status: checkTransportRateLimit(row, 1),
    }))

    return NextResponse.json({
      ok: true,
      rate_limits: enriched,
      privacy_note: GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "rate_limits_failed",
        message: error instanceof Error ? error.message : "Could not load provider rate limits.",
      },
      { status: 500 },
    )
  }
}
