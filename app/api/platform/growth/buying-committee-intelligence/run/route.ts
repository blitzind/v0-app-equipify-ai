import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { evaluateBuyingCommitteeIntelligenceCertification } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-certification"
import {
  runBuyingCommitteeIntelligenceForCanonicalCompany,
  BuyingCommitteeIntelligencePreflightError,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator"
import { isGrowthBuyingCommitteeIntelligenceSchemaReady } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-schema-health"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  company_id: z.string().uuid(),
  promote: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "company_id is required." },
      { status: 400 },
    )
  }

  if (!(await isGrowthBuyingCommitteeIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
        message: `Apply migration ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION} first.`,
      },
      { status: 503 },
    )
  }

  const certification = evaluateBuyingCommitteeIntelligenceCertification()
  const startedMs = Date.now()

  try {
    const result = await runBuyingCommitteeIntelligenceForCanonicalCompany(access.admin, {
      company_id: parsed.data.company_id,
      promote: parsed.data.promote,
      created_by: access.userId,
    })

    logGrowthEngine("buying_committee_intelligence_run", {
      run_id: result.run_id,
      company_id: result.company_id,
      member_count: result.member_count,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
      coverage_score: result.coverage.coverage_score,
      duration_ms: Date.now() - startedMs,
      actor_user_id: access.userId,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
      certification,
      result,
    })
  } catch (e) {
    if (e instanceof BuyingCommitteeIntelligencePreflightError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message, certification },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Buying committee intelligence collection failed."
    logGrowthEngine("buying_committee_intelligence_run_failed", {
      message,
      actor_user_id: access.userId,
    })
    return NextResponse.json(
      { ok: false, error: "buying_committee_intelligence_failed", message },
      { status: 500 },
    )
  }
}
