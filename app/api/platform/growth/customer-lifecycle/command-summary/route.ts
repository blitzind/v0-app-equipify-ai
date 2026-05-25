import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCustomerLifecycleCommandSummary } from "@/lib/growth/customer-lifecycle/customer-lifecycle-dashboard-repository"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      summary: null,
    })
  }

  try {
    const summary = await fetchGrowthCustomerLifecycleCommandSummary(access.admin)
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, summary })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load customer lifecycle summary." }, { status: 500 })
  }
}
