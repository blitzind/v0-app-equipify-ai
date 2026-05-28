import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchInboxDashboard } from "@/lib/growth/inbox/thread-repository"
import { sanitizeGrowthInboxApiErrorMessage } from "@/lib/growth/inbox/inbox-api-errors"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"
import { GROWTH_UNIFIED_INBOX_PRIVACY_NOTE } from "@/lib/growth/inbox/inbox-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270129120000_growth_unified_inbox.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const payload = await fetchInboxDashboard(access.admin)
    return NextResponse.json({
      ok: true,
      ...payload,
      privacy_note: GROWTH_UNIFIED_INBOX_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "inbox_dashboard_failed",
        message: sanitizeGrowthInboxApiErrorMessage(error, "Could not load inbox dashboard."),
      },
      { status: 500 },
    )
  }
}
