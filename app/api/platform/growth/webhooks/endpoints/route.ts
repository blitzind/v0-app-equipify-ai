import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createProviderWebhookEndpoint, listProviderWebhookEndpoints } from "@/lib/growth/webhooks/webhook-repository"
import { isGrowthProviderWebhookSchemaReady } from "@/lib/growth/webhooks/webhook-schema-health"
import { hashWebhookSigningSecret } from "@/lib/growth/webhooks/webhook-sanitizer"
import { GROWTH_WEBHOOK_PRIVACY_NOTE } from "@/lib/growth/webhooks/webhook-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderWebhookSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270411120000_growth_provider_webhook_ingestion.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const endpoints = await listProviderWebhookEndpoints(access.admin)
    return NextResponse.json({ ok: true, endpoints, privacy_note: GROWTH_WEBHOOK_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

const createSchema = z.object({
  providerFamily: z.enum(["google", "microsoft", "ses", "resend", "smtp", "custom"]),
  endpointSlug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  status: z.enum(["active", "disabled", "simulation"]).optional(),
  signingSecret: z.string().min(8).max(256).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderWebhookSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270411120000_growth_provider_webhook_ingestion.sql, then reload.",
      },
      { status: 503 },
    )
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", message: parsed.error.message }, { status: 400 })
  }

  try {
    const endpoint = await createProviderWebhookEndpoint(access.admin, {
      providerFamily: parsed.data.providerFamily,
      endpointSlug: parsed.data.endpointSlug,
      status: parsed.data.status,
      signingSecretHash: parsed.data.signingSecret ? hashWebhookSigningSecret(parsed.data.signingSecret) : null,
      metadata: parsed.data.metadata,
    })
    return NextResponse.json({
      ok: true,
      endpoint,
      privacy_note: GROWTH_WEBHOOK_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
