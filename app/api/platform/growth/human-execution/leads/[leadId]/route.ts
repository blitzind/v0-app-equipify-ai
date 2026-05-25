import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthHumanExecutionLeadView } from "@/lib/growth/human-execution/human-execution-service"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "@/lib/growth/human-execution/human-execution-types"
import {
  GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE,
  isGrowthHumanExecutionSchemaReady,
} from "@/lib/growth/human-execution/human-execution-schema-health"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      leadView: null,
    })
  }

  try {
    const leadView = await fetchGrowthHumanExecutionLeadView(access.admin, leadId)
    if (!leadView) return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
      meta: { schemaReady: true },
      leadView,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load execution lead view."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
