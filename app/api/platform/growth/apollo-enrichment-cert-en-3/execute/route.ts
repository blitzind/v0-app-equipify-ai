import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloEnrichmentCertEn3InProduction } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route"
import { validateApolloEnrichmentCertEn3Confirmation } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloEnrichmentCertEn3Confirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "confirmation_required",
        message: confirmation.error,
      },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloEnrichmentCertEn3InProduction(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
  })

  logGrowthEngine("apollo_enrichment_cert_en_3_production_execute", {
    execution_id: result.execution_id,
    company_candidate_id: result.company_candidate_id?.slice(0, 8) ?? null,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    api_calls: result.evidence?.runtime.api_calls ?? 0,
    credits_consumed: result.evidence?.enrichment.credits_consumed ?? 0,
    promotion_attempted: result.evidence?.promotion.promotion_attempted ?? false,
    company_contacts_synced: result.evidence?.promotion.company_contacts_synced ?? 0,
    contactable_after_promotion: result.evidence?.promotion.contactable_after_promotion ?? 0,
    verdict: result.evidence_bundle?.verdict ?? null,
    failure_errors: result.evidence_bundle?.errors ?? null,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
