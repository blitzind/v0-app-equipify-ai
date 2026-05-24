import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAttentionDashboard } from "@/lib/growth/notifications/notification-repository"
import { evaluateGrowthAttentionSignals } from "@/lib/growth/notifications/evaluate-growth-attention-signals"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const refresh = new URL(request.url).searchParams.get("refresh") === "true"

  try {
    if (refresh) await evaluateGrowthAttentionSignals(access.admin)
    const dashboard = await fetchGrowthAttentionDashboard(access.admin, access.userId)
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load attention dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
