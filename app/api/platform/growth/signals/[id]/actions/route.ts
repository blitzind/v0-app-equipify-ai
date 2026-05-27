import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyGrowthSignalAction } from "@/lib/growth/signals/signal-actions"
import { GROWTH_SIGNAL_WATCHLISTS_QA_MARKER } from "@/lib/growth/signals/signal-watchlist-types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const signalId = id?.trim()
  if (!signalId) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Signal id is required." },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    watchlist_id?: string | null
  }

  const action = body.action?.trim()
  if (!action) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Action is required." },
      { status: 400 },
    )
  }

  const result = await applyGrowthSignalAction(access.admin, {
    signal_id: signalId,
    action,
    watchlist_id: body.watchlist_id ?? null,
    userId: access.userId,
  })

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "blocked_action" || result.error === "unsupported_action"
          ? 403
          : result.error === "validation_error"
            ? 400
            : 503
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
        error: result.error,
        message: result.message,
      },
      { status },
    )
  }

  return NextResponse.json(result)
}
