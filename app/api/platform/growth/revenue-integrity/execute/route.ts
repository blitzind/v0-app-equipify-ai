import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeRevenueIntegrityCertification } from "@/lib/growth/revenue-integrity/revenue-integrity-route"
import { validateRevenueIntegrityCertificationConfirmation } from "@/lib/growth/revenue-integrity/revenue-integrity-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateRevenueIntegrityCertificationConfirmation(body)
  if (!confirmation.ok || !confirmation.draft_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "confirmation_required",
        message: confirmation.error,
      },
      { status: 400 },
    )
  }

  const repair = body && typeof body === "object" && (body as Record<string, unknown>).repair === true

  const startedMs = Date.now()
  const result = await executeRevenueIntegrityCertification(access.admin, {
    draft_id: confirmation.draft_id,
    repair,
    dry_run: confirmation.dry_run,
    operator_email: access.userEmail,
  })

  logGrowthEngine("revenue_integrity_certification_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    draft_id: confirmation.draft_id,
    repair,
    dry_run: confirmation.dry_run,
    duration_ms: Date.now() - startedMs,
    blockers: result.blockers,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
