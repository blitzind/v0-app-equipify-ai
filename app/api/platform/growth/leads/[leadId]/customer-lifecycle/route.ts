import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCustomerProfileByLeadId } from "@/lib/growth/customer-lifecycle/customer-profile-repository"
import { listGrowthCustomerOnboardingTasks } from "@/lib/growth/customer-lifecycle/customer-onboarding-task-repository"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      profile: null,
      tasks: [],
    })
  }

  try {
    const profile = await fetchGrowthCustomerProfileByLeadId(access.admin, leadId)
    if (!profile) return NextResponse.json({ ok: true, meta: { schemaReady: true }, profile: null, tasks: [] })
    const tasks = await listGrowthCustomerOnboardingTasks(access.admin, { customerProfileId: profile.id })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, profile, tasks })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load customer lifecycle." }, { status: 500 })
  }
}
