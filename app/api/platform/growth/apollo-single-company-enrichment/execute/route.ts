import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloSingleCompanyEnrichmentDiagnostic } from "@/lib/growth/apollo/apollo-single-company-enrichment-diagnostic"
import { validateApolloSingleCompanyEnrichmentDiagnosticConfirmation } from "@/lib/growth/apollo/apollo-single-company-enrichment-diagnostic-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloSingleCompanyEnrichmentDiagnosticConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloSingleCompanyEnrichmentDiagnostic(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
    company_name: confirmation.company_name,
    rerun_search: confirmation.rerun_search,
    env: process.env,
  })

  logGrowthEngine("apollo_single_company_enrichment_diagnostic_execute", {
    ok: result.ok,
    duration_ms: Date.now() - startedMs,
    company_name: result.company?.company_name ?? confirmation.company_name,
    mapped_contacts: result.enrichment_evidence?.mapped_contacts_count ?? 0,
    enrichment_attempted: result.enrichment_evidence?.enrichment_attempted ?? false,
    enrichment_updated: result.enrichment_evidence?.enrichment_candidates_updated ?? 0,
    verified_emails: result.enrichment_evidence?.enrichment_verified_email_contacts ?? 0,
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
