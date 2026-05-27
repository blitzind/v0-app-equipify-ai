import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSequenceExperimentDashboard } from "@/lib/growth/experiments/experiment-dashboard"
import { isGrowthSequenceAbTestingSchemaReady } from "@/lib/growth/experiments/experiment-schema-health"
import { GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE } from "@/lib/growth/experiments/experiment-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply sequence A/B testing migration." }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthSequenceExperimentDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load experiment dashboard." }, { status: 500 })
  }
}
