import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import { fetchGrowthRelationshipDashboard } from "@/lib/growth/relationship-dashboard-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthRelationshipDashboard(access.admin)
    return growthHomeNoStoreJson({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return growthHomeNoStoreJson({ error: "fetch_failed", message }, { status: 500 })
  }
}
