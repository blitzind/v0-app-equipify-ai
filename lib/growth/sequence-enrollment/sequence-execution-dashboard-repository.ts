import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { detectSequenceDrift } from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import {
  ENROLLMENT_SELECT,
  STEP_SELECT,
  mapGrowthSequenceEnrollmentRow,
  mapGrowthSequenceEnrollmentStepRow,
  type EnrollmentRow,
  type StepRow,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-mappers"

export async function fetchGrowthSequenceExecutionDashboard(admin: SupabaseClient) {
  const { data: enrollments, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select(`${ENROLLMENT_SELECT}, leads!inner(company_name)`)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  const rows = (enrollments ?? []) as Array<EnrollmentRow & { leads: { company_name: string } }>
  const active = rows.filter((row) => row.status === "active")
  const paused = rows.filter((row) => row.status === "paused")
  const executionStalled = rows.filter((row) => row.enrollment_stalled)
  const completedRecently = rows.filter(
    (row) =>
      row.status === "completed" &&
      row.completed_at &&
      Date.parse(row.completed_at) >= Date.now() - 30 * 24 * 60 * 60 * 1000,
  )

  const { data: steps, error: stepsError } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select(`${STEP_SELECT}, leads!inner(company_name)`)
    .in("status", ["queued", "draft_created", "failed"])
    .order("updated_at", { ascending: false })
    .limit(100)

  if (stepsError) throw new Error(stepsError.message)

  const stepRows = (steps ?? []) as Array<StepRow & { leads: { company_name: string } }>
  const awaitingApproval = stepRows.filter((row) => row.status === "queued" || row.status === "draft_created")
  const failedSteps = stepRows.filter((row) => row.status === "failed")

  const patterns = await listGrowthSequencePatterns(admin)
  const driftSignals = []

  for (const enrollment of rows.filter((row) => ["active", "paused"].includes(row.status)).slice(0, 50)) {
    const pattern = patterns.find((entry) => entry.id === enrollment.sequence_pattern_id)
    const { data: enrollmentSteps } = await admin
      .schema("growth")
      .from("sequence_enrollment_steps")
      .select(STEP_SELECT)
      .eq("enrollment_id", enrollment.id)
    driftSignals.push(
      ...detectSequenceDrift({
        enrollmentId: enrollment.id,
        leadId: enrollment.lead_id,
        companyName: enrollment.leads.company_name,
        patternKey: pattern?.key ?? null,
        steps: ((enrollmentSteps ?? []) as StepRow[]).map(mapGrowthSequenceEnrollmentStepRow),
        patternSteps: pattern?.steps ?? [],
      }),
    )
  }

  const healthScores = rows
    .filter((row) => row.status === "active" || row.status === "paused")
    .map((row) => row.enrollment_health_score)
  const averageHealth =
    healthScores.length > 0
      ? Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length)
      : 0

  return {
    averageHealth,
    activeEnrollments: active.map((row) => ({
      ...mapGrowthSequenceEnrollmentRow(row),
      companyName: row.leads.company_name,
    })),
    pausedEnrollments: paused.map((row) => ({
      ...mapGrowthSequenceEnrollmentRow(row),
      companyName: row.leads.company_name,
    })),
    executionStalled: executionStalled.map((row) => ({
      ...mapGrowthSequenceEnrollmentRow(row),
      companyName: row.leads.company_name,
    })),
    awaitingApproval: awaitingApproval.map((row) => ({
      ...mapGrowthSequenceEnrollmentStepRow(row),
      companyName: row.leads.company_name,
    })),
    failedSteps: failedSteps.map((row) => ({
      ...mapGrowthSequenceEnrollmentStepRow(row),
      companyName: row.leads.company_name,
    })),
    completedRecently: completedRecently.map((row) => ({
      ...mapGrowthSequenceEnrollmentRow(row),
      companyName: row.leads.company_name,
    })),
    sequenceDriftWatch: driftSignals.slice(0, 20),
    sequenceExecutionHealth: {
      activeCount: active.length,
      stalledCount: executionStalled.length,
      awaitingApprovalCount: awaitingApproval.length,
      failedCount: failedSteps.length,
      driftCount: driftSignals.length,
    },
  }
}
