import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCustomerLifecycleDashboard } from "@/lib/growth/customer-lifecycle/customer-lifecycle-dashboard-repository"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
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
  const refresh = url.searchParams.get("refresh") === "true"

  try {
    const dashboard = await fetchGrowthCustomerLifecycleDashboard(access.admin, { ownerUserId, refresh })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load customer lifecycle dashboard." }, { status: 500 })
  }
}
