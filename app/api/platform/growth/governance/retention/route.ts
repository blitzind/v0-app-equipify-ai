import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGovernanceRetentionPolicies, upsertGovernanceRetentionPolicy } from "@/lib/growth/governance/dashboard"
import { isGrowthEnterpriseGovernanceSchemaReady } from "@/lib/growth/governance/schema-health"
import { GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE } from "@/lib/growth/governance/governance-types"

export const runtime = "nodejs"

const retentionSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["platform", "audit", "export", "delivery", "activity"]),
  retentionDays: z.number().int().min(0).max(3650),
  legalHold: z.boolean().optional(),
  description: z.string().max(500).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const retention = await listGovernanceRetentionPolicies(access.admin)
    return NextResponse.json({ ok: true, retention, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
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

  const parsed = retentionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  try {
    const retention = await upsertGovernanceRetentionPolicy(access.admin, {
      ...parsed.data,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, retention, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
