import { NextResponse } from "next/server"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthSmsSchemaReady } from "@/lib/growth/sms/schema-health"
import {
  ingestTwilioSmsInboundWebhook,
  parseTwilioSmsWebhookRequest,
} from "@/lib/growth/sms/webhooks/twilio-sms-ingestion"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isGrowthEngineEnabledEnv()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 })
  }

  let admin
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config" }, { status: 503 })
  }

  if (!(await isGrowthSmsSchemaReady(admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const rawBody = await request.text()
  const params = parseTwilioSmsWebhookRequest(rawBody)
  const signatureHeader = request.headers.get("x-twilio-signature")

  try {
    const result = await ingestTwilioSmsInboundWebhook(admin, {
      rawBody,
      params,
      signatureHeader,
      requestUrl: request.url,
    })

    if (result.signatureFailed) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    logGrowthEngine("twilio_sms_inbound_webhook", {
      eventId: result.eventId,
      duplicate: result.duplicate ?? false,
      conversationId: result.conversationId,
    })

    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logGrowthEngine("twilio_sms_inbound_webhook_failed", { message })
    return NextResponse.json({ error: "webhook_failed", message }, { status: 500 })
  }
}
