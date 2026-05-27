import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSalesExecutionDashboard } from "@/lib/growth/reply-intelligence/sales-execution-dashboard"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  const sinceDays = z.coerce.number().int().min(1).max(90).catch(30).parse(url.searchParams.get("sinceDays") ?? "30")
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  try {
    const dashboard = await fetchGrowthSalesExecutionDashboard(access.admin, { ownerUserId, since })
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load reply intelligence dashboard." }, { status: 500 })
  }
}
