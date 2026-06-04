import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enqueueCompanyIntelligenceJob } from "@/lib/growth/company-intelligence/company-intelligence-queue"
import { isGrowthCompanyIntelligenceRuntimeSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import { GROWTH_COMPANY_INTELLIGENCE_QA_MARKER } from "@/lib/growth/company-intelligence/company-intelligence-types"
import {
  GROWTH_COMPANY_INTELLIGENCE_JOB_MIGRATION,
  GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
} from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export const runtime = "nodejs"

const EnqueueSchema = z.object({
  company_id: z.string().uuid(),
  promote_on_complete: z.boolean().optional(),
  trigger_source: z
    .enum(["manual", "company_enriched", "browser_extension", "infrastructure_panel"])
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = EnqueueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Invalid enqueue payload." },
      { status: 400 },
    )
  }

  if (!(await isGrowthCompanyIntelligenceRuntimeSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_COMPANY_INTELLIGENCE_JOB_MIGRATION,
      },
      { status: 503 },
    )
  }

  const result = await enqueueCompanyIntelligenceJob(access.admin, {
    company_id: parsed.data.company_id,
    promote_on_complete: parsed.data.promote_on_complete ?? false,
    trigger_source: parsed.data.trigger_source ?? "manual",
    created_by: access.userId,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "enqueue_failed", message: result.reason },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
    runtime_qa_marker: GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
    enqueued: result.enqueued,
    job_id: result.enqueued && "job_id" in result ? result.job_id : null,
    reason: result.enqueued ? null : result.reason,
  })
}
