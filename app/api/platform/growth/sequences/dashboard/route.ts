import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSequenceExecutionFoundationDashboard } from "@/lib/growth/sequences/sequence-repository"
import { listSequenceExecutionEvents } from "@/lib/growth/sequences/sequence-events"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"
import { GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE } from "@/lib/growth/sequences/sequence-types"
import { fetchAttributionRates } from "@/lib/growth/tracking/tracking-repository"
import { isGrowthEngagementTrackingSchemaReady } from "@/lib/growth/tracking/tracking-schema-health"
import { fetchPatternEnrollmentStats } from "@/lib/growth/sequence-enrollment/pattern-enrollment-stats"
import { GROWTH_ENROLLMENT_PLANES_DOC } from "@/lib/growth/sequence-enrollment/enrollment-planes-doc"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceExecutionSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270128120000_growth_sequence_execution.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [overview, events, trackingReady, patternStats] = await Promise.all([
      fetchSequenceExecutionFoundationDashboard(access.admin),
      listSequenceExecutionEvents(access.admin, { limit: 30 }),
      isGrowthEngagementTrackingSchemaReady(access.admin),
      fetchPatternEnrollmentStats(access.admin),
    ])
    const attributionRates = trackingReady ? await fetchAttributionRates(access.admin) : null
    return NextResponse.json({
      ok: true,
      ...overview,
      events,
      attribution_rates: attributionRates,
      privacy_note: GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE,
      pattern_stats: patternStats,
      enrollment_planes: GROWTH_ENROLLMENT_PLANES_DOC,
    })
  } catch {
    return NextResponse.json(
      { error: "sequence_dashboard_failed", message: "Could not load sequence execution dashboard." },
      { status: 500 },
    )
  }
}
