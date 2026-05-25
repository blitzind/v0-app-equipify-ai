import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCallCopilotDashboard } from "@/lib/growth/call-copilot-dashboard-repository"
import { fetchGrowthNativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
  isGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const copilotDashboard = await fetchGrowthCallCopilotDashboard(access.admin)
    const schemaReady = await isGrowthNativeDialerSchemaReady(access.admin)
    const workspaceDashboard = schemaReady
      ? await fetchGrowthNativeCallWorkspaceDashboard(access.admin, access.userId)
      : null

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      dashboard: copilotDashboard,
      workspaceDashboard,
      meta: schemaReady ? { schemaReady: true } : { schemaReady: false, setupMessage: GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load calls dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
