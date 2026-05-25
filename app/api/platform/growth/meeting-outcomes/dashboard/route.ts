import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthMeetingOutcomeDashboardView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-service"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import {
  GROWTH_MEETING_OUTCOME_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingOutcomeSchemaReady,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMeetingOutcomeSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_OUTCOME_SCHEMA_SETUP_MESSAGE },
      dashboard: null,
    })
  }

  try {
    const dashboard = await fetchGrowthMeetingOutcomeDashboardView(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
      meta: { schemaReady: true },
      dashboard,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load meeting outcome dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
