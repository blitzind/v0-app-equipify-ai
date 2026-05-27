import { NextResponse } from "next/server"
import { z } from "zod"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { ingestProviderWebhook } from "@/lib/growth/webhooks/webhook-router"
import { isGrowthProviderWebhookSchemaReady } from "@/lib/growth/webhooks/webhook-schema-health"
import { GROWTH_WEBHOOK_PRIVACY_NOTE } from "@/lib/growth/webhooks/webhook-types"

export const runtime = "nodejs"

const FAMILY_SCHEMA = z.enum(["google", "microsoft", "ses", "resend", "smtp", "custom"])

export async function POST(
  request: Request,
  context: { params: Promise<{ providerFamily: string }> },
) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled", message: "Growth Engine is not enabled." }, { status: 403 })
  }

  const { providerFamily } = await context.params
  const parsedFamily = FAMILY_SCHEMA.safeParse(providerFamily)
  if (!parsedFamily.success) {
    return NextResponse.json({ error: "invalid_provider_family", message: "Unsupported provider family." }, { status: 400 })
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured for webhooks." }, { status: 503 })
  }

  if (!(await isGrowthProviderWebhookSchemaReady(admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270411120000_growth_provider_webhook_ingestion.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON body." }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_body", message: "Expected JSON object body." }, { status: 400 })
    }
    payload = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Malformed JSON body." }, { status: 400 })
  }

  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")

  try {
    const result = await ingestProviderWebhook(admin, {
      providerFamily: parsedFamily.data,
      rawBody,
      payload,
      headers: request.headers,
      querySecret,
    })

    if (result.signatureFailed) {
      logGrowthEngine("provider_webhook_rejected", {
        providerFamily: parsedFamily.data,
        eventId: result.eventId,
      })
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "Webhook signature verification failed." },
        { status: 401 },
      )
    }

    return NextResponse.json({
      ok: result.ok,
      duplicate: result.duplicate ?? false,
      event_id: result.eventId,
      normalized_event_type: result.normalizedEventType,
      processing_status: result.processingStatus,
      privacy_note: GROWTH_WEBHOOK_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logGrowthEngine("provider_webhook_failed", { providerFamily: parsedFamily.data, message })
    return NextResponse.json({ error: "webhook_failed", message: "Webhook processing failed." }, { status: 500 })
  }
}
