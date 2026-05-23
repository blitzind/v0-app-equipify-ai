import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { ensureGrowthStubOutboundConnection } from "@/lib/growth/outbound/connection-repository"
import { mapGrowthProviderApiError } from "@/lib/growth/outbound/provider-api-errors"
import { appendGrowthPlatformTimelineEvent } from "@/lib/growth/outbound/platform-timeline-repository"
import {
  createGrowthProviderConnection,
  listGrowthProviderConnectionSummaries,
} from "@/lib/growth/outbound/provider-connection-repository"
import { probeGrowthProviderConnectionSchema } from "@/lib/growth/outbound/provider-schema-health"
import { GROWTH_PROVIDER_CAPABILITY_LABELS } from "@/lib/growth/outbound/provider-types"
import { listOutboundProviderAdapters } from "@/lib/growth/outbound/providers/registry"
import { GROWTH_OUTBOUND_PROVIDER_FAMILIES } from "@/lib/growth/outbound/types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  providerFamily: z.enum(GROWTH_OUTBOUND_PROVIDER_FAMILIES),
  label: z.string().trim().min(1).max(120),
  apiBaseUrl: z.string().trim().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  monthlyCostEstimate: z.number().min(0).nullable().optional(),
  seatCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const schema = await probeGrowthProviderConnectionSchema(access.admin)
    if (!schema.providerConnector) {
      return NextResponse.json(
        {
          error: "growth_schema_incomplete",
          message:
            "Apply Supabase migration 20270101120000_growth_engine_provider_connector.sql, then reload this page.",
        },
        { status: 503 },
      )
    }

    await ensureGrowthStubOutboundConnection(access.admin, access.userId)
    const connections = await listGrowthProviderConnectionSummaries(access.admin)
    const adapters = listOutboundProviderAdapters()
    return NextResponse.json({
      ok: true,
      connections,
      adapters,
      capabilityLabels: GROWTH_PROVIDER_CAPABILITY_LABELS,
      schema: { softDelete: schema.softDelete },
    })
  } catch (e) {
    const mapped = mapGrowthProviderApiError(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid provider connection payload." }, { status: 400 })
  }

  try {
    const adapter = listOutboundProviderAdapters().find(
      (entry) => entry.providerFamily === parsed.data.providerFamily,
    )
    if (!adapter) {
      return NextResponse.json({ error: "unknown_provider_family", message: "Unknown provider family." }, { status: 400 })
    }

    const connection = await createGrowthProviderConnection(access.admin, {
      provider: adapter.providerKey,
      providerFamily: parsed.data.providerFamily,
      label: parsed.data.label,
      apiBaseUrl: parsed.data.apiBaseUrl,
      config: parsed.data.config,
      monthlyCostEstimate: parsed.data.monthlyCostEstimate,
      seatCount: parsed.data.seatCount,
      notes: parsed.data.notes,
      createdBy: access.userId,
    })

    await appendGrowthPlatformTimelineEvent(access.admin, {
      connectionId: connection.id,
      eventType: "provider_connected",
      title: `${connection.label} created`,
      summary: "Provider connection created and awaiting validation.",
      payload: { providerFamily: connection.providerFamily },
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, connection }, { status: 201 })
  } catch (e) {
    const mapped = mapGrowthProviderApiError(e)
    return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status })
  }
}
