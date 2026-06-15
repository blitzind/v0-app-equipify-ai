import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthSequenceEnrollmentById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { sequenceConditionSpecSchema } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import { evaluateSequenceConditionReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import { GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"

export const runtime = "nodejs"

const EvaluateSequenceConditionSchema = z
  .object({
    organization_id: z.string().uuid().optional(),
    enrollment_id: z.string().uuid(),
    enrollment_step_id: z.string().uuid(),
    condition_spec: sequenceConditionSpecSchema,
    now: z.string().datetime().optional(),
  })
  .strict()

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const parsed = EvaluateSequenceConditionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    )
  }

  const organizationId = parsed.data.organization_id ?? getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "organization_id_required", message: "GROWTH_ENGINE_AI_ORG_ID is required." },
      { status: 400 },
    )
  }

  try {
    const enrollment = await fetchGrowthSequenceEnrollmentById(access.admin, parsed.data.enrollment_id)
    if (!enrollment) {
      return NextResponse.json({ ok: false, error: "enrollment_not_found" }, { status: 404 })
    }

    const step = await fetchGrowthSequenceEnrollmentStepById(access.admin, parsed.data.enrollment_step_id)
    if (!step || step.enrollmentId !== enrollment.id) {
      return NextResponse.json({ ok: false, error: "enrollment_step_not_found" }, { status: 404 })
    }

    const lead = await fetchGrowthLeadById(access.admin, enrollment.leadId)
    if (!lead) {
      return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 })
    }

    if (lead.promotedOrganizationId && lead.promotedOrganizationId !== organizationId) {
      return NextResponse.json({ ok: false, error: "organization_scope_mismatch" }, { status: 403 })
    }

    const result = await evaluateSequenceConditionReadOnly(access.admin, {
      enrollmentId: parsed.data.enrollment_id,
      enrollmentStepId: parsed.data.enrollment_step_id,
      conditionSpec: parsed.data.condition_spec,
      now: parsed.data.now,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER,
      organization_id: organizationId,
      read_only: true,
      branch_execution_enabled: false,
      scheduler_action_enabled: false,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "evaluate_failed", message }, { status: 500 })
  }
}
