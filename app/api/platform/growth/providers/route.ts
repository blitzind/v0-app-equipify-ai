import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createDeliveryProvider,
  listDeliveryProviders,
  listDeliveryRoutes,
  upsertDeliveryRoute,
} from "@/lib/growth/providers/provider-repository"
import { listDeliveryProviderRegistry } from "@/lib/growth/providers/provider-registry"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"
import {
  GROWTH_DELIVERY_PROVIDER_FAMILIES,
  GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER,
  GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE,
} from "@/lib/growth/providers/provider-types"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

export const runtime = "nodejs"

const CreateProviderSchema = z.object({
  providerKey: z.string().trim().min(2).max(120),
  providerName: z.string().trim().min(2).max(200),
  providerFamily: z.enum(GROWTH_DELIVERY_PROVIDER_FAMILIES),
  maxDailyVolume: z.number().int().min(0).max(1_000_000).optional(),
  senderAccountId: z.string().uuid().optional(),
  routePriority: z.number().int().min(0).max(10_000).optional(),
  dailyCap: z.number().int().min(0).max(1_000_000).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270130120000_growth_provider_delivery.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [providers, routes, senders] = await Promise.all([
      listDeliveryProviders(access.admin),
      listDeliveryRoutes(access.admin),
      listSenderAccounts(access.admin),
    ])
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER,
      privacy_note: GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE,
      providers,
      routes,
      senders,
      registry: listDeliveryProviderRegistry(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "delivery_providers_list_failed",
        message: error instanceof Error ? error.message : "Could not load delivery providers.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateProviderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid delivery provider payload." }, { status: 400 })
  }

  try {
    const provider = await createDeliveryProvider(access.admin, {
      provider_key: parsed.data.providerKey,
      provider_name: parsed.data.providerName,
      provider_family: parsed.data.providerFamily,
      max_daily_volume: parsed.data.maxDailyVolume,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    let route = null
    if (parsed.data.senderAccountId) {
      route = await upsertDeliveryRoute(access.admin, {
        provider_id: provider.id,
        sender_account_id: parsed.data.senderAccountId,
        priority: parsed.data.routePriority,
        daily_cap: parsed.data.dailyCap,
        actorUserId: access.userId,
        actorEmail: access.userEmail,
      })
    }

    return NextResponse.json({ ok: true, provider, route }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create delivery provider."
    const status = message === "sender_not_found" ? 404 : message.includes("duplicate") ? 409 : 500
    return NextResponse.json({ error: "delivery_provider_create_failed", message }, { status })
  }
}
