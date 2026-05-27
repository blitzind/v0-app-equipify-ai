import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchProviderSetupReadiness } from "@/lib/growth/provider-setup/dashboard"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const readiness = await fetchProviderSetupReadiness(access.admin)
  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, readiness })
}
