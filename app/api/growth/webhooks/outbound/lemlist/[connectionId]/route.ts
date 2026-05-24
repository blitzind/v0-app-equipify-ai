import { NextResponse } from "next/server"
import { z } from "zod"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { ingestOutboundWebhookPayload } from "@/lib/growth/outbound/ingest-webhook"
import { fetchGrowthProviderConnectionInternal } from "@/lib/growth/outbound/provider-connection-repository"
import { verifyLemlistWebhookSecret } from "@/lib/growth/outbound/providers/lemlist/lemlist-webhook-mapper"
import { LEMLIST_PROVIDER_KEY } from "@/lib/growth/outbound/providers/lemlist/lemlist-labels"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled", message: "Growth Engine is not enabled." }, { status: 403 })
  }

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Invalid connection id." }, { status: 400 })
  }

  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured for webhooks." }, { status: 503 })
  }

  const connection = await fetchGrowthProviderConnectionInternal(admin, connectionId)
  if (!connection || connection.provider !== LEMLIST_PROVIDER_KEY || connection.status !== "active") {
    return NextResponse.json({ error: "not_found", message: "Lemlist connection not found." }, { status: 404 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON object body." }, { status: 400 })
  }

  const headers: Record<string, unknown> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const verify = verifyLemlistWebhookSecret({
    secret: connection.webhookSecret,
    headers: new Headers(Object.entries(headers).map(([key, value]) => [key, String(value)])),
    payload: payload as Record<string, unknown>,
    querySecret,
  })

  if (!verify.ok) {
    logGrowthEngine("lemlist_webhook_rejected", { connectionId, reason: verify.message ?? "invalid_secret" })
    return NextResponse.json({ error: "unauthorized", message: "Webhook secret verification failed." }, { status: 401 })
  }

  try {
    const result = await ingestOutboundWebhookPayload(admin, {
      provider: LEMLIST_PROVIDER_KEY,
      payload,
      headers,
      connectionId,
      signaturePreVerified: true,
      querySecret,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logGrowthEngine("lemlist_webhook_failed", { connectionId, message })
    return NextResponse.json({ error: "webhook_failed", message: "Webhook processing failed." }, { status: 500 })
  }
}
