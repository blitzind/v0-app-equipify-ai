import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listInboxThreads, listLeadsForInbox } from "@/lib/growth/inbox/thread-repository"
import { sanitizeGrowthInboxApiErrorMessage } from "@/lib/growth/inbox/inbox-api-errors"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"
import {
  GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER,
  GROWTH_UNIFIED_INBOX_PRIVACY_NOTE,
} from "@/lib/growth/inbox/inbox-types"

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
    const [threads, leads] = await Promise.all([
      listInboxThreads(access.admin),
      listLeadsForInbox(access.admin),
    ])
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER,
      privacy_note: GROWTH_UNIFIED_INBOX_PRIVACY_NOTE,
      threads,
      leads,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "inbox_list_failed",
        message: sanitizeGrowthInboxApiErrorMessage(error, "Could not load inbox threads."),
      },
      { status: 500 },
    )
  }
}
