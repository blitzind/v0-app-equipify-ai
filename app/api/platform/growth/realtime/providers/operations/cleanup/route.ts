import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildLiveCoachingCleanupQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { runRealtimeProviderOperationalCleanup } from "@/lib/growth/realtime/providers/realtime-provider-operations"

export const runtime = "nodejs"

export async function POST() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const result = await runRealtimeProviderOperationalCleanup(access.admin)
    const qaProof = buildLiveCoachingCleanupQaProofMarker(result)
    return NextResponse.json({ ok: true, result, qaProof })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "cleanup_failed", message }, { status: 500 })
  }
}
