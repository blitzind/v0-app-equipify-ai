import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { memberContextToRoutingInsight } from "@/lib/growth/sender-pools/health-aware-routing"
import { GROWTH_HEALTH_AWARE_ROUTING_QA_MARKER } from "@/lib/growth/sender-pools/health-aware-routing-types"
import {
  buildSenderPoolMemberContext,
  resolveSenderRotationForPool,
} from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { appendSenderPoolTimelineEvent } from "@/lib/growth/sender-pools/sender-pool-events"
import { explainIneligibleMembers } from "@/lib/growth/sender-pools/sender-rotation"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import {
  getSenderPool,
  listSenderPoolMembers,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

export const runtime = "nodejs"

const SimulateSchema = z.object({
  allowAutoRotation: z.boolean().optional(),
  manualSenderAccountId: z.string().uuid().nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = SimulateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid simulation payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const pool = await getSenderPool(access.admin, id)
    if (!pool) return NextResponse.json({ error: "not_found", message: "Sender pool not found." }, { status: 404 })

    const rotation = await resolveSenderRotationForPool(access.admin, {
      senderPoolId: id,
      allowAutoRotation: parsed.data.allowAutoRotation ?? pool.allowAutoRotation,
      manualSenderAccountId: parsed.data.manualSenderAccountId ?? null,
      persistDecision: false,
    })

    const [members, routes] = await Promise.all([
      listSenderPoolMembers(access.admin, id),
      listDeliveryRoutes(access.admin),
    ])
    const contexts = []
    for (const member of members) {
      const ctx = await buildSenderPoolMemberContext(access.admin, member, routes)
      if (ctx) contexts.push(ctx)
    }
    const ineligible = explainIneligibleMembers(contexts, pool.minComplianceScore, pool.requiresMailbox)

    await appendSenderPoolTimelineEvent(access.admin, {
      eventType: "sender_pool_rotated",
      title: "Sender pool simulation",
      summary: rotation.selectedSenderAccountId
        ? `Simulation selected ${rotation.reason} with ${rotation.riskLevel} risk.`
        : "Simulation found no eligible sender.",
      metadata: { sender_pool_id: id, simulated: true },
    })

    const routingInsights = contexts.map((ctx) => memberContextToRoutingInsight(ctx, id, null))

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_HEALTH_AWARE_ROUTING_QA_MARKER,
      rotation,
      ineligibleMembers: ineligible,
      routingInsights,
      privacy_note: "Simulation only — no message sent.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "simulate_failed", message }, { status: 500 })
  }
}
