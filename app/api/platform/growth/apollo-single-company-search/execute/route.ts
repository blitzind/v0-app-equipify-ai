import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloSingleCompanySearchDiagnostic } from "@/lib/growth/apollo/apollo-single-company-search-diagnostic"
import { validateApolloSingleCompanySearchDiagnosticConfirmation } from "@/lib/growth/apollo/apollo-single-company-search-diagnostic-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloSingleCompanySearchDiagnosticConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloSingleCompanySearchDiagnostic(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
    company_name: confirmation.company_name,
    env: process.env,
  })

  logGrowthEngine("apollo_single_company_search_diagnostic_execute", {
    ok: result.ok,
    duration_ms: Date.now() - startedMs,
    company_name: result.company?.company_name ?? confirmation.company_name,
    raw_contacts_returned: result.search_summary?.raw_contacts_returned ?? 0,
    mapped_contacts: result.search_summary?.mapped_contacts ?? 0,
    stop_reason: result.search_summary?.stop_reason ?? null,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }
  if (!result.ok && result.error === "company_not_found") {
    return NextResponse.json(result, { status: 404 })
  }
  return NextResponse.json(result)
}
