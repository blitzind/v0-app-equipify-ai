import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { testDeliveryRoute } from "@/lib/growth/providers/provider-repository"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"
import { GROWTH_DELIVERY_PROVIDER_STATUSES } from "@/lib/growth/providers/provider-types"

export const runtime = "nodejs"

const RouteTestSchema = z.object({
  senderAccountId: z.string().uuid(),
  volume: z.number().int().min(1).max(1_000_000).optional(),
  providerState: z.enum(GROWTH_DELIVERY_PROVIDER_STATUSES).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = RouteTestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid route test payload." }, { status: 400 })
  }

  try {
    const selection = await testDeliveryRoute(access.admin, {
      sender_account_id: parsed.data.senderAccountId,
      requested_volume: parsed.data.volume ?? 1,
      force_provider_status: parsed.data.providerState,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, selection })
  } catch (error) {
    return NextResponse.json(
      {
        error: "delivery_route_test_failed",
        message: error instanceof Error ? error.message : "Could not simulate delivery route.",
      },
      { status: 500 },
    )
  }
}
