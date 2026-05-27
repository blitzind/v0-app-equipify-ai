import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchOperatorExecutionWorkspaceV2 } from "@/lib/growth/revenue-intelligence/operator-execution-workspace-v2"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit") ?? "50")

  try {
    const workspace = await fetchOperatorExecutionWorkspaceV2(access.admin, { limit })
    return NextResponse.json({ ok: true, workspace })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load operator execution workspace." }, { status: 500 })
  }
}
