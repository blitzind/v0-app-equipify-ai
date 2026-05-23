import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { ensureGrowthStubOutboundConnection, listGrowthOutboundConnections } from "@/lib/growth/outbound/connection-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    await ensureGrowthStubOutboundConnection(access.admin, access.userId)
    const connections = await listGrowthOutboundConnections(access.admin)
    return NextResponse.json({ ok: true, connections })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "list_failed", message }, { status: 500 })
  }
}
