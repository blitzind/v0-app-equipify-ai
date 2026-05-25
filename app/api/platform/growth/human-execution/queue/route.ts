import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthHumanExecutionQueueView } from "@/lib/growth/human-execution/human-execution-service"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "@/lib/growth/human-execution/human-execution-types"
import {
  GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE,
  isGrowthHumanExecutionSchemaReady,
} from "@/lib/growth/human-execution/human-execution-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      queue: { items: [] },
    })
  }

  try {
    const queue = await fetchGrowthHumanExecutionQueueView(access.admin)
    return NextResponse.json({ ok: true, qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, queue })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load human execution queue."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
