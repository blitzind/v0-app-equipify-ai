import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { BulkSequenceEnrollmentLeadOutcome } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import type { GrowthSequenceEnrollment } from "@/lib/growth/sequence-enrollment-types"
import {
  isBulkEnrollmentSchedulerEligible,
  suggestBulkEnrollmentAction,
  summarizeEnrollmentStepContext,
} from "@/lib/growth/sequence-enrollment/bulk-enrollment-result-ui"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"

export async function enrichBulkSequenceEnrollmentOutcome(
  admin: SupabaseClient,
  leadId: string,
  base: BulkSequenceEnrollmentLeadOutcome,
): Promise<BulkSequenceEnrollmentLeadOutcome> {
  const viewEnrollmentId = base.enrollmentId ?? base.conflictingEnrollmentId
  if (!viewEnrollmentId) return base

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, viewEnrollmentId)
  const steps = enrollment ? await listGrowthSequenceEnrollmentSteps(admin, viewEnrollmentId) : []

  return {
    ...base,
    leadId,
    enrollmentStatus: enrollment?.status ?? base.enrollmentStatus,
    sequencePatternId: enrollment?.sequencePatternId ?? base.sequencePatternId,
    currentStepSummary: summarizeEnrollmentStepContext(enrollment, steps) ?? base.currentStepSummary,
    schedulerEligible: enrollment
      ? isBulkEnrollmentSchedulerEligible(enrollment.status)
      : base.schedulerEligible,
    suggestedAction: base.suggestedAction ?? suggestBulkEnrollmentAction(enrollment?.status),
  }
}

export async function fetchConflictingSequenceEnrollment(
  admin: SupabaseClient,
  leadId: string,
  excludeEnrollmentId?: string | null,
): Promise<GrowthSequenceEnrollment | null> {
  let query = admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)

  if (excludeEnrollmentId) {
    query = query.neq("id", excludeEnrollmentId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) return null

  return fetchGrowthSequenceEnrollmentById(admin, String(data.id))
}
