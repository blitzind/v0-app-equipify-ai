import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloSequenceExecutionFunnelMetrics } from "@/lib/growth/apollo/apollo-sequence-execution-automation-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const metrics = await loadApolloSequenceExecutionFunnelMetrics(access.admin)
    return NextResponse.json({ ok: true, metrics })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
