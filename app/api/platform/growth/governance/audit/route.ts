import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGovernanceApprovalAudit } from "@/lib/growth/governance/approval-audit"
import { isGrowthEnterpriseGovernanceSchemaReady } from "@/lib/growth/governance/schema-health"
import { GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE } from "@/lib/growth/governance/governance-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam) || 50)) : 50

  try {
    const audit = await listGovernanceApprovalAudit(access.admin, { limit })
    return NextResponse.json({ ok: true, audit, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
