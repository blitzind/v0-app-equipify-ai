import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { ingestOutboundWebhookPayload } from "@/lib/growth/outbound/ingest-webhook"
import { isKnownOutboundProvider } from "@/lib/growth/outbound/providers/registry"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { provider } = await context.params
  if (!isKnownOutboundProvider(provider)) {
    return NextResponse.json({ error: "invalid_provider", message: "Unknown outbound provider." }, { status: 400 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON body." }, { status: 400 })
  }

  try {
    const headers: Record<string, unknown> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    const result = await ingestOutboundWebhookPayload(access.admin, {
      provider,
      payload,
      headers,
      actorUserId: access.userId,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "webhook_failed", message }, { status: 500 })
  }
}
