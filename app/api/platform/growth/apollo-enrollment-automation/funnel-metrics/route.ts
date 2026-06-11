import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-automation-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const metrics = await loadApolloEnrollmentFunnelMetrics(access.admin)
    return NextResponse.json({ ok: true, metrics })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
