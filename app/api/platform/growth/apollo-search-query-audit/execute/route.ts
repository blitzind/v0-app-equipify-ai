import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloSearchQueryAuditInProduction } from "@/lib/growth/apollo/apollo-search-query-audit-route"
import { validateApolloSearchQueryAuditConfirmation } from "@/lib/growth/apollo/apollo-search-query-audit-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloSearchQueryAuditConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloSearchQueryAuditInProduction(access.admin, {
    created_by: access.userId,
    env: process.env,
  })

  logGrowthEngine("apollo_search_query_audit_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    duration_ms: Date.now() - startedMs,
    companies_audited: result.companies?.length ?? 0,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  return NextResponse.json(result)
}
