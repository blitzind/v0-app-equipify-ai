import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { refreshSignalWatchlistMatches } from "@/lib/growth/signals/signal-watchlist-repository"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const result = await refreshSignalWatchlistMatches(access.admin, id?.trim() ?? "")

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "validation_error" ? 400 : 503
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
