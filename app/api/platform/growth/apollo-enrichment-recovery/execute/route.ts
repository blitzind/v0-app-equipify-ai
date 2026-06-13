import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloEnrichmentRecoveryInProduction } from "@/lib/growth/apollo/apollo-enrichment-recovery-production-route"
import { validateApolloEnrichmentRecoveryConfirmation } from "@/lib/growth/apollo/apollo-enrichment-recovery-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloEnrichmentRecoveryConfirmation(body)
  if (!confirmation.ok || !confirmation.input) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloEnrichmentRecoveryInProduction(access.admin, {
    ...confirmation.input,
    created_by: access.userId,
  })

  logGrowthEngine("apollo_enrichment_recovery_execute", {
    execution_id: result.execution_id,
    ok: result.ok,
    dry_run: result.dry_run,
    duration_ms: Date.now() - startedMs,
    companies_targeted: result.recovery_results.companies_targeted,
    companies_processed: result.recovery_results.companies_processed,
    companies_recovered: result.recovery_results.companies_recovered,
    contacts_enriched: result.recovery_results.contacts_enriched,
    emails_recovered: result.recovery_results.emails_recovered,
    verified_email_companies_before: result.before_after.verified_email_companies_before,
    verified_email_companies_after: result.before_after.verified_email_companies_after,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  return NextResponse.json(result)
}
