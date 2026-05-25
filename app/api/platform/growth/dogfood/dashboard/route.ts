import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthDogfoodReadinessDashboard } from "@/lib/growth/dogfood/dogfood-dashboard-repository"
import { GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE, isGrowthDogfoodSchemaReady } from "@/lib/growth/dogfood/dogfood-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDogfoodSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE },
      dashboard: null,
    })
  }

  try {
    const dashboard = await fetchGrowthDogfoodReadinessDashboard(access.admin)
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load dogfood dashboard." }, { status: 500 })
  }
}
