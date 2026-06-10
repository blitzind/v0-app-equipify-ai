import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { buildApolloTierAttemptsCompactSummaries } from "@/lib/growth/apollo/apollo-search-diagnostic-evidence"
import { executeApolloScale3InProduction } from "@/lib/growth/apollo/apollo-scale-3-production-route"
import { formatApolloScale5ExecutionFailure } from "@/lib/growth/apollo/apollo-scale-5-execution-errors"
import { validateApolloScale3Confirmation } from "@/lib/growth/apollo/apollo-scale-3-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 300

function jsonResponse(payload: unknown, status: number): NextResponse {
  try {
    return NextResponse.json(payload, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : "response_serialization_failed"
    return NextResponse.json(
      {
        ok: false,
        error: "response_serialization_failed",
        message,
        stage: "response_serialization",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloScale3Confirmation(body)
  if (!confirmation.ok) {
    return jsonResponse(
      { ok: false, error: "confirmation_required", message: confirmation.error, stage: "readiness_gates" },
      400,
    )
  }

  const startedMs = Date.now()

  try {
    const result = await executeApolloScale3InProduction(access.admin, {
      company_limit: confirmation.company_limit,
      contact_limit: confirmation.contact_limit,
      created_by: access.userId,
      env: process.env,
    })

    logGrowthEngine("apollo_scale_3_production_execute", {
      execution_id: result.execution_id,
      ok: result.ok,
      stage: result.stage,
      verdict: result.verdict,
      duration_ms: Date.now() - startedMs,
      companies_processed: result.companies.length,
      tier_4_companies: result.companies.filter((row) => row.tier_used === 4).length,
      tier_5_companies: result.companies.filter((row) => row.tier_used === 5).length,
      legacy_fallback_companies: result.companies.filter((row) => row.legacy_fallback_used).length,
      mapped_companies: result.companies.filter((row) => row.mapped_contacts > 0).length,
      verified_email_contacts: result.aggregate?.verified_email_contacts ?? 0,
      apollo_contacts_found: result.aggregate?.apollo_contacts_found ?? 0,
      apollo_contactable_contacts: result.aggregate?.contactable_after_promotion ?? 0,
      legacy_contactable_contacts: result.aggregate?.legacy_contactable_contacts ?? 0,
      search_outcomes: result.companies.reduce<Record<string, number>>((acc, row) => {
        const outcome = row.acquisition_evidence?.search_outcome ?? "unknown"
        acc[outcome] = (acc[outcome] ?? 0) + 1
        return acc
      }, {}),
      tier_attempts_by_company: result.companies.map((row) => ({
        company_name: row.company_name,
        search_outcome: row.acquisition_evidence?.search_outcome ?? "unknown",
        raw_contacts_returned: row.raw_contacts_returned,
        mapped_contacts: row.mapped_contacts,
        tier_attempts_compact:
          row.tier_attempts_compact ??
          buildApolloTierAttemptsCompactSummaries(row.tier_attempts ?? []),
        mapper_rejection_evidence: row.mapper_rejection_evidence ?? null,
      })),
      auto_enrollment: false,
      outreach_sent: false,
    })

    if (!result.ok && result.error === "gates_failed") {
      return jsonResponse(result, 403)
    }
    if (!result.ok && result.error === "cohort_failed") {
      return jsonResponse(result, 422)
    }
    return jsonResponse(result, 200)
  } catch (error) {
    const failure = formatApolloScale5ExecutionFailure({
      execution_id: "unassigned",
      stage: "evidence_build",
      error: "execution_failed",
      message: error instanceof Error ? error.message : "Apollo-Scale-3 execute route failed",
      company: null,
      cause: error,
      env: process.env,
    })

    logGrowthEngine("apollo_scale_3_production_execute", {
      execution_id: failure.execution_id,
      ok: false,
      stage: failure.stage,
      error: failure.error,
      message: failure.message,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
    })

    return jsonResponse(failure, 500)
  }
}
