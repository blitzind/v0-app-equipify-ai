import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateCampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-service"
import { CAMPAIGN_READINESS_SUBJECT_TYPES } from "@/lib/growth/campaign-readiness/campaign-readiness-types"

export const runtime = "nodejs"
export const maxDuration = 120

const GenerateSchema = z.object({
  subject_type: z.enum(CAMPAIGN_READINESS_SUBJECT_TYPES).optional(),
  subject_ref: z.string().max(200).optional(),
  lead_id: z.string().max(120).optional(),
  execution_run_id: z.string().max(120).optional(),
  search_plan_id: z.string().max(120).optional(),
  persist_audit: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = GenerateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const subject_type = parsed.data.subject_type ?? (parsed.data.lead_id ? "prospect" : "account")
  const subject_ref =
    parsed.data.subject_ref ??
    parsed.data.lead_id ??
    parsed.data.execution_run_id ??
    "unknown"

  try {
    const result = await generateCampaignReadinessAssessment(access.admin, {
      subject_type,
      subject_ref,
      lead_id: parsed.data.lead_id,
      execution_run_id: parsed.data.execution_run_id,
      search_plan_id: parsed.data.search_plan_id,
      persist_audit: parsed.data.persist_audit ?? true,
    })

    if (!result.ok || !result.assessment) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "generate_failed" },
        { status: 422 },
      )
    }

    return NextResponse.json({
      ok: true,
      assessment: result.assessment,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generate_failed", message }, { status: 500 })
  }
}
