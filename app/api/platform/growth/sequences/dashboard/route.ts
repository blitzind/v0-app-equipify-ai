import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSequenceExecutionFoundationDashboard } from "@/lib/growth/sequences/sequence-repository"
import { listSequenceExecutionEvents } from "@/lib/growth/sequences/sequence-events"
import { isGrowthSequenceExecutionSchemaReady } from "@/lib/growth/sequences/sequence-schema-health"
import { GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE } from "@/lib/growth/sequences/sequence-types"

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
    const [overview, events] = await Promise.all([
      fetchSequenceExecutionFoundationDashboard(access.admin),
      listSequenceExecutionEvents(access.admin, { limit: 30 }),
    ])
    return NextResponse.json({
      ok: true,
      ...overview,
      events,
      privacy_note: GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE,
    })
  } catch {
    return NextResponse.json(
      { error: "sequence_dashboard_failed", message: "Could not load sequence execution dashboard." },
      { status: 500 },
    )
  }
}
