import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloIntelligenceRecoveryReadiness } from "@/lib/growth/apollo/apollo-intelligence-recovery-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const readiness = await loadApolloIntelligenceRecoveryReadiness(access.admin)
    return NextResponse.json({ ok: true, readiness })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
