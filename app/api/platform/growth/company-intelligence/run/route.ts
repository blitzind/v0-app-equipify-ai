import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { evaluateCompanyIntelligenceCertification } from "@/lib/growth/company-intelligence/company-intelligence-certification"
import {
  runCompanyIntelligenceForCanonicalCompany,
  CompanyIntelligencePreflightError,
} from "@/lib/growth/company-intelligence/company-intelligence-orchestrator"
import { isGrowthCompanyIntelligenceSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import {
  GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

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

  if (!(await isGrowthCompanyIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
        message: `Apply migration ${GROWTH_COMPANY_INTELLIGENCE_MIGRATION} first.`,
      },
      { status: 503 },
    )
  }

  const certification = evaluateCompanyIntelligenceCertification()
  const startedMs = Date.now()

  try {
    const result = await runCompanyIntelligenceForCanonicalCompany(access.admin, {
      company_id: parsed.data.company_id,
      promote: parsed.data.promote,
      created_by: access.userId,
    })

    logGrowthEngine("company_intelligence_run", {
      run_id: result.run_id,
      company_id: result.company_id,
      finding_count: result.finding_count,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
      duration_ms: Date.now() - startedMs,
      actor_user_id: access.userId,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
      certification,
      result,
    })
  } catch (e) {
    if (e instanceof CompanyIntelligencePreflightError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message, certification },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Company intelligence collection failed."
    logGrowthEngine("company_intelligence_run_failed", { message, actor_user_id: access.userId })
    return NextResponse.json({ ok: false, error: "company_intelligence_failed", message }, { status: 500 })
  }
}
