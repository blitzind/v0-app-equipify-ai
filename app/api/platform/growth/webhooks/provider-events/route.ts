import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchProviderWebhookDashboard, listRecentProviderDeliveryEvents } from "@/lib/growth/webhooks/webhook-repository"
import { isGrowthProviderWebhookSchemaReady } from "@/lib/growth/webhooks/webhook-schema-health"
import { GROWTH_WEBHOOK_PRIVACY_NOTE } from "@/lib/growth/webhooks/webhook-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
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

  const limitParam = new URL(request.url).searchParams.get("limit")
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam) || 50)) : 50

  try {
    const dashboard = await fetchProviderWebhookDashboard(access.admin)
    const events = await listRecentProviderDeliveryEvents(access.admin, limit)
    return NextResponse.json({
      ok: true,
      dashboard: { ...dashboard, events },
      privacy_note: GROWTH_WEBHOOK_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
