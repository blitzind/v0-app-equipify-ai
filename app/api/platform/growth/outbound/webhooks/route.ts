import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listUnresolvedGrowthProviderWebhooks } from "@/lib/growth/outbound/webhook-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const webhooks = await listUnresolvedGrowthProviderWebhooks(access.admin)
    return NextResponse.json({ ok: true, webhooks })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "list_failed", message }, { status: 500 })
  }
}
