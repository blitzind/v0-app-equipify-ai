import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthInternalOutboundOperationsDashboard } from "@/lib/growth/operations/internal-outbound-operations-dashboard"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthInternalOutboundOperationsDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = /is not defined$/i.test(raw) || /^ReferenceError/i.test(raw)
      ? "Send infrastructure telemetry is temporarily unavailable. Retry in a moment."
      : raw
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
