import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { PatternEnrollmentStats } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"

export async function fetchPatternEnrollmentStats(admin: SupabaseClient): Promise<PatternEnrollmentStats> {
  const [{ count: activeCount }, { count: draftCount }, { count: pausedCount }, { count: pendingApprovalJobs }] =
    await Promise.all([
      admin
        .schema("growth")
        .from("sequence_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .schema("growth")
        .from("sequence_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      admin
        .schema("growth")
        .from("sequence_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "paused"),
      admin
        .schema("growth")
        .from("sequence_execution_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "pending_approval"]),
    ])

  return {
    activeCount: activeCount ?? 0,
    draftCount: draftCount ?? 0,
    pausedCount: pausedCount ?? 0,
    pendingApprovalJobs: pendingApprovalJobs ?? 0,
  }
}

export async function fetchPatternEnrollmentWithSteps(
  admin: SupabaseClient,
  enrollmentId: string,
) {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, enrollmentId)
  if (!enrollment) return null

  const [steps, patternRes, leadRes] = await Promise.all([
    listGrowthSequenceEnrollmentSteps(admin, enrollmentId),
    admin
      .schema("growth")
      .from("sequence_patterns")
      .select("key, label")
      .eq("id", enrollment.sequencePatternId)
      .maybeSingle(),
    admin.schema("growth").from("leads").select("company_name, contact_name").eq("id", enrollment.leadId).maybeSingle(),
  ])

  return {
    ...enrollment,
    steps,
    patternKey: (patternRes.data?.key as string | undefined) ?? null,
    patternLabel: (patternRes.data?.label as string | undefined) ?? null,
    leadLabel:
      (leadRes.data?.company_name as string | undefined)?.trim() ||
      (leadRes.data?.contact_name as string | undefined)?.trim() ||
      "Lead",
  }
}
