import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadGrowthSignalById } from "@/lib/growth/signals/signal-repository"
import { GROWTH_SIGNAL_FOUNDATION_QA_MARKER } from "@/lib/growth/signals/signal-types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
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

  const signal = await loadGrowthSignalById(access.admin, signalId)
  if (!signal) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Signal not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
    signal,
  })
}
