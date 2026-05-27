import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchComplianceDashboard } from "@/lib/growth/compliance/compliance-repository"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { GROWTH_COMPLIANCE_PRIVACY_NOTE } from "@/lib/growth/compliance/compliance-types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const leadId = new URL(request.url).searchParams.get("lead_id")?.trim()

  try {
    if (leadId) {
      if (!UUID_RE.test(leadId)) {
        return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
      }
      const { fetchLeadComplianceDetail } = await import("@/lib/growth/compliance/compliance-repository")
      const detail = await fetchLeadComplianceDetail(access.admin, leadId)
      return NextResponse.json({ ok: true, detail, privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE })
    }

    const dashboard = await fetchComplianceDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_COMPLIANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
