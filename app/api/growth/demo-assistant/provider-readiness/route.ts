import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGeV14RetellProviderReadinessReport } from "@/lib/growth/demo-assistant/ge-v1-4-retell-provider-readiness"
import { GE_V1_4_DEMO_ASSISTANT_QA_MARKER } from "@/lib/growth/demo-assistant/ge-v1-4-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const report = await buildGeV14RetellProviderReadinessReport(access.admin)
  return NextResponse.json({
    ok: true,
    report,
    qa_marker: GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
  })
}
