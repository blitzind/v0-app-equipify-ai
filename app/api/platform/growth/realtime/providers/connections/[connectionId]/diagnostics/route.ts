import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchRealtimeProviderDiagnosticsBundle } from "@/lib/growth/realtime/providers/realtime-provider-diagnostics"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
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
    const bundle = await fetchRealtimeProviderDiagnosticsBundle(access.admin, connectionId)
    if (!bundle) {
      return NextResponse.json({ error: "not_found", message: "Connection not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...bundle })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "diagnostics_failed", message }, { status: 500 })
  }
}
