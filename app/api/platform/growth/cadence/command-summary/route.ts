import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-dashboard-repository"
import { GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE, isGrowthCadenceSchemaReady } from "@/lib/growth/cadence/cadence-schema-health"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCadenceSchemaReady(access.admin))) {
    return growthHomeNoStoreJson({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE },
      summary: null,
    })
  }

  try {
    const summary = await fetchGrowthCadenceCommandSummary(access.admin)
    return growthHomeNoStoreJson({ ok: true, meta: { schemaReady: true }, summary })
  } catch {
    return growthHomeNoStoreJson(
      { error: "fetch_failed", message: "Could not load cadence command summary." },
      { status: 500 },
    )
  }
}
