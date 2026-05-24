import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listLemlistCampaigns } from "@/lib/growth/outbound/providers/lemlist/lemlist-api-client"
import { syncLemlistCampaignsForConnection } from "@/lib/growth/outbound/providers/lemlist/lemlist-campaign-sync"
import { parseLemlistConnectionConfig } from "@/lib/growth/outbound/providers/lemlist/lemlist-config"
import { LEMLIST_PROVIDER_KEY } from "@/lib/growth/outbound/providers/lemlist/lemlist-labels"
import {
  fetchGrowthProviderConnectionInternal,
  readGrowthProviderConnectionCredentials,
} from "@/lib/growth/outbound/provider-connection-repository"

export const runtime = "nodejs"

function toAdapterConnection(connection: NonNullable<Awaited<ReturnType<typeof fetchGrowthProviderConnectionInternal>>>) {
  return {
    id: connection.id,
    provider: connection.provider,
    providerFamily: connection.providerFamily,
    label: connection.label,
    status: connection.status as "active" | "disabled" | "error",
    apiBaseUrl: connection.apiBaseUrl,
    webhookSecret: connection.webhookSecretConfigured ? "[configured]" : null,
    config: connection.config,
    lastWebhookAt: null,
    lastError: connection.health.lastErrorMessage,
    monthlyCostEstimate: connection.monthlyCostEstimate,
    seatCount: connection.seatCount,
    notes: connection.notes,
    createdBy: null,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Invalid connection id." }, { status: 400 })
  }

  const connection = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
  if (!connection || connection.provider !== LEMLIST_PROVIDER_KEY) {
    return NextResponse.json({ error: "not_found", message: "Lemlist connection not found." }, { status: 404 })
  }

  const credentials = readGrowthProviderConnectionCredentials(connection)
  const apiKey = typeof credentials?.apiKey === "string" ? credentials.apiKey : null
  if (!apiKey) {
    return NextResponse.json({ error: "missing_credentials", message: "Lemlist API key is required." }, { status: 400 })
  }

  try {
    const campaigns = await listLemlistCampaigns({
      apiKey,
      apiBaseUrl: connection.apiBaseUrl,
    })
    const config = parseLemlistConnectionConfig(connection.config)
    return NextResponse.json({
      ok: true,
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        selected: campaign.id === config.defaultCampaignId,
      })),
      config,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "list_failed", message }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Invalid connection id." }, { status: 400 })
  }

  const connection = await fetchGrowthProviderConnectionInternal(access.admin, connectionId)
  if (!connection || connection.provider !== LEMLIST_PROVIDER_KEY) {
    return NextResponse.json({ error: "not_found", message: "Lemlist connection not found." }, { status: 404 })
  }

  const credentials = readGrowthProviderConnectionCredentials(connection)
  const apiKey = typeof credentials?.apiKey === "string" ? credentials.apiKey : null
  if (!apiKey) {
    return NextResponse.json({ error: "missing_credentials", message: "Lemlist API key is required." }, { status: 400 })
  }

  try {
    const synced = await syncLemlistCampaignsForConnection(access.admin, {
      connection: toAdapterConnection(connection),
      apiKey,
    })
    return NextResponse.json({ ok: true, campaigns: synced })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "sync_failed", message }, { status: 500 })
  }
}
