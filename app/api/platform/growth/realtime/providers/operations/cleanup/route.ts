import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runRealtimeProviderOperationalCleanup } from "@/lib/growth/realtime/providers/realtime-provider-operations"

export const runtime = "nodejs"

export async function POST() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const result = await runRealtimeProviderOperationalCleanup(access.admin)
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "cleanup_failed", message }, { status: 500 })
  }
}
