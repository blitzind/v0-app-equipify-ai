import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createSenderPool, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { appendSenderPoolTimelineEvent } from "@/lib/growth/sender-pools/sender-pool-events"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import {
  GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
  GROWTH_SENDER_POOL_ROTATION_STRATEGIES,
  GROWTH_SENDER_POOL_STATUSES,
} from "@/lib/growth/sender-pools/sender-pool-types"

export const runtime = "nodejs"

const CreatePoolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(GROWTH_SENDER_POOL_STATUSES).optional(),
  rotationStrategy: z.enum(GROWTH_SENDER_POOL_ROTATION_STRATEGIES).optional(),
  dailyPoolCap: z.number().int().min(0).nullable().optional(),
  requiresMailbox: z.boolean().optional(),
  minComplianceScore: z.number().min(0).max(100).optional(),
  allowAutoRotation: z.boolean().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const pools = await listSenderPools(access.admin)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
      privacy_note: GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE,
      pools,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreatePoolSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sender pool payload." }, { status: 400 })
  }

  try {
    const pool = await createSenderPool(access.admin, parsed.data)
    await appendSenderPoolTimelineEvent(access.admin, {
      eventType: "sender_pool_created",
      title: "Sender pool created",
      summary: `Pool "${pool.name}" created with ${pool.rotationStrategy} strategy.`,
      metadata: { sender_pool_id: pool.id },
    })
    return NextResponse.json({ ok: true, pool })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
