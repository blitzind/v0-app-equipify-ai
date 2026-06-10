import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloScale5InProduction } from "@/lib/growth/apollo/apollo-scale-5-production-route"
import { formatApolloScale5ExecutionFailure } from "@/lib/growth/apollo/apollo-scale-5-execution-errors"
import { validateApolloScale5Confirmation } from "@/lib/growth/apollo/apollo-scale-5-production-route-gates"

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
  const confirmation = validateApolloScale5Confirmation(body)
  if (!confirmation.ok) {
    return jsonResponse(
      {
        ok: false,
        error: "confirmation_required",
        message: confirmation.error,
        stage: "readiness_gates",
      },
      400,
    )
  }

  const startedMs = Date.now()

  try {
    const result = await executeApolloScale5InProduction(access.admin, {
      contact_limit: confirmation.contact_limit,
      created_by: access.userId,
      env: process.env,
    })

    logGrowthEngine("apollo_scale_5_production_execute", {
      execution_id: result.execution_id,
      ok: result.ok,
      stage: result.stage,
      error: result.ok ? null : result.error ?? null,
      message: result.ok ? null : result.message ?? null,
      duration_ms: Date.now() - startedMs,
      mapped_contacts: result.certification?.search.mapped_contacts ?? 0,
      verified_email_contacts: result.certification?.promotion.verified_email_contacts ?? 0,
      promoted_contacts: result.certification?.readiness.promoted_contacts ?? 0,
      contactable_contacts: result.certification?.readiness.contactable_contacts ?? 0,
      sequence_ready_contacts: result.certification?.readiness.sequence_ready_contacts ?? 0,
      email_enrichment_candidates_selected: result.certification?.email_enrichment.candidates_selected ?? 0,
      email_enrichment_error: result.certification?.email_enrichment.error ?? null,
      verdict: result.verdict,
      auto_enrollment: false,
      outreach_sent: false,
      scheduler_run: false,
      execution_created: false,
    })

    if (!result.ok && result.error === "gates_failed") {
      return jsonResponse(result, 403)
    }

    if (!result.ok && result.error === "target_company_failed") {
      return jsonResponse(result, 422)
    }

    if (!result.ok) {
      return jsonResponse(result, 500)
    }

    return jsonResponse(result, 200)
  } catch (error) {
    const failure = formatApolloScale5ExecutionFailure({
      execution_id: "unassigned",
      stage: "evidence_build",
      error: "execution_failed",
      message: error instanceof Error ? error.message : "Apollo-Scale-5 execute route failed",
      company: null,
      cause: error,
      env: process.env,
    })

    logGrowthEngine("apollo_scale_5_production_execute", {
      execution_id: failure.execution_id,
      ok: false,
      stage: failure.stage,
      error: failure.error,
      message: failure.message,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      scheduler_run: false,
      execution_created: false,
    })

    return jsonResponse(failure, 500)
  }
}
