import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthMeetingOutcomeLeadView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-service"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import {
  GROWTH_MEETING_OUTCOME_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingOutcomeSchemaReady,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-schema-health"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  if (!(await isGrowthMeetingOutcomeSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_OUTCOME_SCHEMA_SETUP_MESSAGE },
      leadView: null,
    })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })

    const leadView = await fetchGrowthMeetingOutcomeLeadView(access.admin, leadId, lead.companyName)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER,
      meta: { schemaReady: true },
      leadView,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load meeting outcome lead view."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
