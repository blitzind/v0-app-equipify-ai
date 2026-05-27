import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  deleteSenderPool,
  getSenderPool,
  listSenderPoolMembers,
  listSenderRotationDecisions,
  updateSenderPool,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import {
  GROWTH_SENDER_POOL_ROTATION_STRATEGIES,
  GROWTH_SENDER_POOL_STATUSES,
} from "@/lib/growth/sender-pools/sender-pool-types"

export const runtime = "nodejs"

const PatchPoolSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(GROWTH_SENDER_POOL_STATUSES).optional(),
  rotationStrategy: z.enum(GROWTH_SENDER_POOL_ROTATION_STRATEGIES).optional(),
  dailyPoolCap: z.number().int().min(0).nullable().optional(),
  requiresMailbox: z.boolean().optional(),
  minComplianceScore: z.number().min(0).max(100).optional(),
  allowAutoRotation: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const pool = await getSenderPool(access.admin, id)
    if (!pool) return NextResponse.json({ error: "not_found", message: "Sender pool not found." }, { status: 404 })
    const [members, rotationDecisions] = await Promise.all([
      listSenderPoolMembers(access.admin, id),
      listSenderRotationDecisions(access.admin, { poolId: id, limit: 20 }),
    ])
    return NextResponse.json({ ok: true, pool, members, rotationDecisions })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchPoolSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender pool update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const pool = await updateSenderPool(access.admin, id, parsed.data)
    return NextResponse.json({ ok: true, pool })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    await deleteSenderPool(access.admin, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 })
  }
}
