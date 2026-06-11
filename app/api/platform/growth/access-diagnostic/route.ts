import { NextResponse } from "next/server"
import { loadGrowthEngineAccessDiagnostic } from "@/lib/growth/growth-engine-access-diagnostic-route"

export const runtime = "nodejs"

/**
 * Temporary production-safe auth diagnostic. Enable with
 * GROWTH_ENGINE_ACCESS_DIAGNOSTIC_ENABLED=true — remove after verification.
 */
export async function GET(request: Request) {
  const diagnostic = await loadGrowthEngineAccessDiagnostic(request)

  if (diagnostic.access_decision === "diagnostic_disabled") {
    return NextResponse.json(
      {
        ok: false,
        error: "diagnostic_disabled",
        message: "Set GROWTH_ENGINE_ACCESS_DIAGNOSTIC_ENABLED=true to enable this route.",
        diagnostic,
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: diagnostic.access_decision === "allowed",
    diagnostic,
  })
}
