import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateGovernanceExport, listGovernanceExports } from "@/lib/growth/governance/export-service"
import { isGrowthEnterpriseGovernanceSchemaReady } from "@/lib/growth/governance/schema-health"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE,
  GROWTH_GOVERNANCE_EXPORT_TYPES,
} from "@/lib/growth/governance/governance-types"

export const runtime = "nodejs"

const exportSchema = z.object({
  exportType: z.enum(GROWTH_GOVERNANCE_EXPORT_TYPES),
  approvalReason: z.string().max(500).optional(),
  humanApprovalConfirmed: z.literal(true),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const exports = await listGovernanceExports(access.admin)
    return NextResponse.json({ ok: true, exports, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = exportSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  try {
    const exportRecord = await generateGovernanceExport(access.admin, {
      exportType: parsed.data.exportType,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      sourceRoute: "/api/platform/growth/governance/exports",
      approvalReason: parsed.data.approvalReason,
    })
    return NextResponse.json({ ok: true, export: exportRecord, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "governance_policy_blocked") {
      return NextResponse.json({ error: "governance_policy_blocked", message }, { status: 403 })
    }
    return NextResponse.json({ error: "export_failed", message }, { status: 500 })
  }
}
