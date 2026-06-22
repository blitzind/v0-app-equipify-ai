import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGeV15RuntimeReadinessReport } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-readiness"
import { buildGeV15ProviderReadinessReport } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-provider-readiness"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const readiness = buildGeV15RuntimeReadinessReport()
  const provider = await buildGeV15ProviderReadinessReport(access.admin)

  return NextResponse.json({
    ok: true,
    readiness,
    provider,
    qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  })
}
