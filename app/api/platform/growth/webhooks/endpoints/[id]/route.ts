import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { updateProviderWebhookEndpoint } from "@/lib/growth/webhooks/webhook-repository"
import { isGrowthProviderWebhookSchemaReady } from "@/lib/growth/webhooks/webhook-schema-health"
import { hashWebhookSigningSecret } from "@/lib/growth/webhooks/webhook-sanitizer"
import { GROWTH_WEBHOOK_PRIVACY_NOTE } from "@/lib/growth/webhooks/webhook-types"

export const runtime = "nodejs"

const patchSchema = z.object({
  status: z.enum(["active", "disabled", "simulation"]).optional(),
  signingSecret: z.string().min(8).max(256).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id", message: "Endpoint id must be a UUID." }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", message: parsed.error.message }, { status: 400 })
  }

  try {
    const endpoint = await updateProviderWebhookEndpoint(access.admin, id, {
      status: parsed.data.status,
      signingSecretHash:
        parsed.data.signingSecret !== undefined
          ? parsed.data.signingSecret
            ? hashWebhookSigningSecret(parsed.data.signingSecret)
            : null
          : undefined,
      metadata: parsed.data.metadata,
    })
    return NextResponse.json({ ok: true, endpoint, privacy_note: GROWTH_WEBHOOK_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
