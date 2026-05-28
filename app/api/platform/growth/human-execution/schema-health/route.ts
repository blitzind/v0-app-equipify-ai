import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER,
  fetchGrowthHumanExecutionSchemaAdminDiagnostics,
} from "@/lib/growth/human-execution/human-execution-schema-health"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "@/lib/growth/human-execution/human-execution-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const diagnostics = await fetchGrowthHumanExecutionSchemaAdminDiagnostics(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
      schemaHealthQaMarker: GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER,
      diagnostics,
    })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
        schemaHealthQaMarker: GROWTH_HUMAN_EXECUTION_SCHEMA_HEALTH_QA_MARKER,
        message: "Could not probe human execution schema health.",
      },
      { status: 500 },
    )
  }
}
