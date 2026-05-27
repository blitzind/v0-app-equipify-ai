import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthInboxSyncDashboard } from "@/lib/growth/inbox-sync/inbox-sync-dashboard"
import { isGrowthInboxSyncSchemaReady } from "@/lib/growth/inbox-sync/inbox-sync-schema-health"
import { GROWTH_INBOX_SYNC_PRIVACY_NOTE } from "@/lib/growth/inbox-sync/inbox-sync-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthInboxSyncSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox sync migration." }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthInboxSyncDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_INBOX_SYNC_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load inbox sync dashboard." }, { status: 500 })
  }
}
