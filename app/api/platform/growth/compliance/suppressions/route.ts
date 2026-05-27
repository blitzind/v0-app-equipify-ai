import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listActiveSuppressions } from "@/lib/growth/compliance/compliance-repository"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { GROWTH_COMPLIANCE_PRIVACY_NOTE } from "@/lib/growth/compliance/compliance-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthComplianceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270410120000_growth_compliance_suppression.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const limitParam = new URL(request.url).searchParams.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 100

  try {
    const suppressions = await listActiveSuppressions(access.admin, {
      limit: Number.isFinite(limit) ? limit : 100,
    })
    return NextResponse.json({ ok: true, suppressions, privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
