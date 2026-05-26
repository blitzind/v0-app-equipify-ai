import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { searchCallWorkspaceLeads } from "@/lib/growth/native-dialer/call-workspace-lead-search"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) {
    return NextResponse.json({ ok: true, leads: [] })
  }

  try {
    const leads = await searchCallWorkspaceLeads(access.admin, q)
    return NextResponse.json({ ok: true, leads })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed."
    return NextResponse.json({ error: "search_failed", message }, { status: 500 })
  }
}
