import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { ensureGrowthStubOutboundConnection, listGrowthOutboundConnections } from "@/lib/growth/outbound/connection-repository"
import {
  GROWTH_OUTBOUND_PROVIDER_CAPABILITIES,
  OUTBOUND_PROVIDER_CAPABILITY_LABELS,
} from "@/lib/growth/outbound/provider-capabilities"

/** Platform-admin internal provider comparison. Future org add-ons filter connections by org ownership. */

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    await ensureGrowthStubOutboundConnection(access.admin, access.userId)
    const connections = await listGrowthOutboundConnections(access.admin)

    return NextResponse.json({
      ok: true,
      capabilityLabels: OUTBOUND_PROVIDER_CAPABILITY_LABELS,
      providers: GROWTH_OUTBOUND_PROVIDER_CAPABILITIES,
      connections,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
