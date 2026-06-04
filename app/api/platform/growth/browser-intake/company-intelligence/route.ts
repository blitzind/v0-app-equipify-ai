import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enqueueCompanyIntelligenceJob } from "@/lib/growth/company-intelligence/company-intelligence-queue"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import { isGrowthCompanyIntelligenceRuntimeSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import { GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  company_id: z.string().uuid(),
  promote_on_complete: z.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const company_id = new URL(request.url).searchParams.get("company_id")?.trim() ?? ""
  if (!company_id) {
    return NextResponse.json({ ok: false, message: "company_id is required." }, { status: 400 })
  }

  const status = await loadCompanyIntelligenceOperatorStatus(access.admin, { company_id })
  if (!status) {
    return NextResponse.json({ ok: false, message: "Canonical company not found." }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
    status,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid company intelligence payload." }, { status: 400 })
  }

  if (!(await isGrowthCompanyIntelligenceRuntimeSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, message: "Company intelligence runtime schema not ready." }, { status: 503 })
  }

  const result = await enqueueCompanyIntelligenceJob(access.admin, {
    company_id: parsed.data.company_id,
    promote_on_complete: parsed.data.promote_on_complete ?? true,
    trigger_source: "browser_extension",
    created_by: access.userId ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.reason }, { status: 400 })
  }

  const status = await loadCompanyIntelligenceOperatorStatus(access.admin, {
    company_id: parsed.data.company_id,
  })

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
    enqueued: result.enqueued,
    job_id: result.enqueued && "job_id" in result ? result.job_id : null,
    reason: result.enqueued ? null : result.reason,
    status,
  })
}
