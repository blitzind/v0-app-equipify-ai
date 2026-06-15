import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getProspectDiscoveryExecutionStatus } from "@/lib/growth/prospect-discovery/prospect-execution-runner"
import { PROSPECT_DISCOVERY_EXECUTION_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-execution-run-types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(
  _request: Request,
  context: { params: Promise<{ executionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { executionId } = await context.params
  const status = await getProspectDiscoveryExecutionStatus(access.admin, executionId)
  if (!status.ok) {
    return NextResponse.json(
      { ok: false, qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER, error: status.error },
      { status: 404 },
    )
  }

  return NextResponse.json(status)
}
