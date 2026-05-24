import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { probeRealtimeProviderHealth } from "@/lib/growth/realtime/providers/provider-health"
import {
  fetchRealtimeProviderConnection,
  sanitizeRealtimeProviderConnectionForApi,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  try {
    const health = await probeRealtimeProviderHealth(access.admin, connectionId)
    const connection = await fetchRealtimeProviderConnection(access.admin, connectionId)
    return NextResponse.json({
      ok: true,
      health,
      connection: connection ? sanitizeRealtimeProviderConnectionForApi(connection) : null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "validate_failed", message }, { status: 500 })
  }
}
