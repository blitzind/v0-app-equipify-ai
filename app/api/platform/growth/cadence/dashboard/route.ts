import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCadenceDashboard } from "@/lib/growth/cadence/cadence-dashboard-repository"
import { GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE, isGrowthCadenceSchemaReady } from "@/lib/growth/cadence/cadence-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCadenceSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE },
      dashboard: null,
    })
  }

  const url = new URL(request.url)
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  try {
    const dashboard = await fetchGrowthCadenceDashboard(access.admin, { ownerUserId })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load cadence dashboard." }, { status: 500 })
  }
}
