import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { replayGrowthProviderWebhookForLead } from "@/lib/growth/outbound/ingest-webhook"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  leadId: z.string().uuid(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { webhookId } = await context.params
  if (!UUID_RE.test(webhookId)) {
    return NextResponse.json({ error: "invalid_webhook", message: "Invalid webhook id." }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide leadId." }, { status: 400 })
  }

  try {
    const results = await replayGrowthProviderWebhookForLead(access.admin, webhookId, parsed.data.leadId)
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "link_failed", message }, { status: 500 })
  }
}
