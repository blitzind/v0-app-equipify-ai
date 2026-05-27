import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  softDeleteDeliveryProvider,
  updateDeliveryProvider,
} from "@/lib/growth/providers/provider-repository"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"
import { GROWTH_DELIVERY_PROVIDER_STATUSES } from "@/lib/growth/providers/provider-types"

export const runtime = "nodejs"

const PatchProviderSchema = z.object({
  providerName: z.string().trim().min(2).max(200).optional(),
  status: z.enum(GROWTH_DELIVERY_PROVIDER_STATUSES).optional(),
  maxDailyVolume: z.number().int().min(0).max(1_000_000).optional(),
  configurationStatus: z.string().trim().max(120).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchProviderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid provider update payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const provider = await updateDeliveryProvider(access.admin, id, {
      provider_name: parsed.data.providerName,
      status: parsed.data.status,
      max_daily_volume: parsed.data.maxDailyVolume,
      configuration_status: parsed.data.configurationStatus,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, provider })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update delivery provider."
    const status = message === "delivery_provider_not_found" ? 404 : 500
    return NextResponse.json({ error: "delivery_provider_update_failed", message }, { status })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    await softDeleteDeliveryProvider(access.admin, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete delivery provider."
    const status = message === "delivery_provider_not_found" ? 404 : 500
    return NextResponse.json({ error: "delivery_provider_delete_failed", message }, { status })
  }
}
