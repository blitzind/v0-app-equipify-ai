import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getGovernancePolicy, updateGovernancePolicy } from "@/lib/growth/governance/dashboard"
import { isGrowthEnterpriseGovernanceSchemaReady } from "@/lib/growth/governance/schema-health"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE,
  GROWTH_GOVERNANCE_POLICY_CATEGORIES,
} from "@/lib/growth/governance/governance-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(GROWTH_GOVERNANCE_POLICY_CATEGORIES).optional(),
})

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const policy = await getGovernancePolicy(access.admin, id)
    if (!policy) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, policy, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthEnterpriseGovernanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  try {
    const policy = await updateGovernancePolicy(access.admin, id, {
      ...parsed.data,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, policy, privacy_note: GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
