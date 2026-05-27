import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createGovernancePolicy, listGovernancePolicies } from "@/lib/growth/governance/dashboard"
import { isGrowthEnterpriseGovernanceSchemaReady } from "@/lib/growth/governance/schema-health"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE,
  GROWTH_GOVERNANCE_POLICY_CATEGORIES,
  GROWTH_GOVERNANCE_RULE_TYPES,
} from "@/lib/growth/governance/governance-types"

export const runtime = "nodejs"

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.enum(GROWTH_GOVERNANCE_POLICY_CATEGORIES),
  rules: z
    .array(
      z.object({
        ruleType: z.enum(GROWTH_GOVERNANCE_RULE_TYPES),
        ruleConfig: z.record(z.unknown()).optional(),
        priority: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const policies = await listGovernancePolicies(access.admin)
    return NextResponse.json({ ok: true, policies, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
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

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  try {
    const policy = await createGovernancePolicy(access.admin, {
      ...parsed.data,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, policy, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
