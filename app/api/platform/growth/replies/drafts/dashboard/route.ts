import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthReplyDraftDashboard } from "@/lib/growth/replies/reply-draft-dashboard"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthReplyDraftDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load reply drafts dashboard." }, { status: 500 })
  }
}
