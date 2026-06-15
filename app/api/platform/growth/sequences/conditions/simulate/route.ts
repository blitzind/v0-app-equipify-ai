import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthSequenceEnrollmentById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { simulateSequenceBranchPreview } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-engine"
import {
  GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER,
  SEQUENCE_BRANCH_SIMULATION_SCENARIOS,
} from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"

export const runtime = "nodejs"

const SimulateSequenceBranchSchema = z
  .object({
    organization_id: z.string().uuid().optional(),
    enrollment_id: z.string().uuid(),
    enrollment_step_id: z.string().uuid(),
    now: z.string().datetime().optional(),
    scenario: z.enum(SEQUENCE_BRANCH_SIMULATION_SCENARIOS).optional(),
    condition_overrides: z.record(z.string().uuid(), z.boolean()).optional(),
  })
  .strict()

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const parsed = SimulateSequenceBranchSchema.safeParse(await request.json().catch(() => ({})))
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

    const simulation = await simulateSequenceBranchPreview(access.admin, {
      enrollmentId: parsed.data.enrollment_id,
      enrollmentStepId: parsed.data.enrollment_step_id,
      now: parsed.data.now,
      scenario: parsed.data.scenario,
      conditionOverrides: parsed.data.condition_overrides,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER,
      organization_id: organizationId,
      read_only: true,
      branch_execution_enabled: false,
      scheduler_action_enabled: false,
      path: simulation.path,
      branch_decisions: simulation.branchDecisions,
      waits: simulation.waits,
      timeouts: simulation.timeouts,
      skipped_steps: simulation.skippedSteps,
      evidence_refs: simulation.evidenceRefs,
      warnings: simulation.warnings,
      condition_evaluations: simulation.conditionEvaluations,
      graph: simulation.graph,
      resolver: simulation.resolver,
      scenario: simulation.scenario,
      evaluated_at: simulation.evaluatedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "simulate_failed", message }, { status: 500 })
  }
}
