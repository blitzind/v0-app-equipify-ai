import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  APOLLO_INTELLIGENCE_RECOVERY_MODES,
  type ApolloIntelligenceRecoveryMode,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
import { validateApolloIntelligenceRecoveryConfirmation } from "@/lib/growth/apollo/apollo-intelligence-recovery-gates"
import { executeApolloIntelligenceRecovery } from "@/lib/growth/apollo/apollo-intelligence-recovery-route"

export const runtime = "nodejs"
export const maxDuration = 300

function parseMode(value: unknown): ApolloIntelligenceRecoveryMode {
  const raw = typeof value === "string" ? value.trim() : "diagnostic_only"
  if (APOLLO_INTELLIGENCE_RECOVERY_MODES.includes(raw as ApolloIntelligenceRecoveryMode)) {
    return raw as ApolloIntelligenceRecoveryMode
  }
  return "diagnostic_only"
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloIntelligenceRecoveryConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", message: confirmation.error },
      { status: 400 },
    )
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const mode = parseMode(record.mode)

  try {
    const startedMs = Date.now()
    const report = await executeApolloIntelligenceRecovery(access.admin, {
      mode,
      created_by: access.userId,
    })

    logGrowthEngine("apollo_intelligence_recovery_execute", {
      mode,
      writes_performed: report.writes_performed,
      recovery_ok: report.recovery_ok,
      severity: report.severity,
      no_op_root_cause: report.no_op_root_cause,
      before_eligible: report.before.eligible_greenfield_companies,
      after_eligible: report.after.eligible_greenfield_companies,
      score_gte_threshold_after: report.after.score_gte_threshold_companies,
      companies_with_score_increase: report.write_evidence.companies_with_score_increase,
      duration_ms: Date.now() - startedMs,
    })

    return NextResponse.json({
      ok: report.recovery_ok,
      severity: report.severity,
      no_op_root_cause: report.no_op_root_cause,
      top_no_op_reasons: report.top_no_op_reasons,
      report,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
