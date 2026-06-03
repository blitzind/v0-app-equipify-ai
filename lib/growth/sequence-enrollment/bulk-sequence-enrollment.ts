import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  confirmGrowthSequenceEnrollment,
  createGrowthSequenceEnrollmentDraft,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import {
  fetchGrowthSequenceEnrollmentForLeadAndPattern,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
  type BulkSequenceEnrollmentLeadOutcome,
  type BulkSequenceEnrollmentResult,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

export { GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

function outcome(
  leadId: string,
  input?: { enrollmentId?: string; code?: string; reason?: string },
): BulkSequenceEnrollmentLeadOutcome {
  return { leadId, ...input }
}

async function resolveExistingEnrollment(
  admin: SupabaseClient,
  leadId: string,
  patternId: string,
): Promise<
  | { kind: "none" }
  | { kind: "same_pattern"; enrollmentId: string; status: string }
  | { kind: "other_pattern"; enrollmentId: string; patternId: string }
> {
  const existing = await fetchGrowthSequenceEnrollmentForLeadAndPattern(admin, leadId, patternId)
  if (existing) {
    return { kind: "same_pattern", enrollmentId: existing.id, status: existing.status }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, sequence_pattern_id, status")
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { kind: "none" }

  return {
    kind: "other_pattern",
    enrollmentId: String(data.id),
    patternId: String(data.sequence_pattern_id),
  }
}

async function enrollSingleLeadInGrowthSequence(
  admin: SupabaseClient,
  input: {
    leadId: string
    patternId: string
    startImmediately: boolean
    scheduledStartAt: string | null
    ownerUserId: string | null
    actingUserId: string
    actingUserEmail: string
    dryRun: boolean
  },
): Promise<{ bucket: keyof Pick<BulkSequenceEnrollmentResult, "enrolled" | "skippedAlreadyEnrolled" | "skippedBlocked" | "failed">; item: BulkSequenceEnrollmentLeadOutcome }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return { bucket: "failed", item: outcome(input.leadId, { code: "not_found", reason: "Lead not found." }) }
  }

  const existing = await resolveExistingEnrollment(admin, input.leadId, input.patternId)
  if (existing.kind === "same_pattern") {
    if (existing.status === "draft" && input.startImmediately && !input.dryRun) {
      try {
        const confirmed = await confirmGrowthSequenceEnrollment(admin, {
          leadId: input.leadId,
          enrollmentId: existing.enrollmentId,
          actingUserId: input.actingUserId,
          actingUserEmail: input.actingUserEmail,
        })
        return {
          bucket: "enrolled",
          item: outcome(input.leadId, { enrollmentId: confirmed.id, code: "confirmed_existing_draft" }),
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : "confirm_failed"
        return {
          bucket: "failed",
          item: outcome(input.leadId, { enrollmentId: existing.enrollmentId, code, reason: "Could not confirm existing draft enrollment." }),
        }
      }
    }

    return {
      bucket: "skippedAlreadyEnrolled",
      item: outcome(input.leadId, {
        enrollmentId: existing.enrollmentId,
        code: "already_enrolled",
        reason: "Lead is already enrolled in this sequence.",
      }),
    }
  }

  if (existing.kind === "other_pattern") {
    return {
      bucket: "skippedBlocked",
      item: outcome(input.leadId, {
        enrollmentId: existing.enrollmentId,
        code: "active_enrollment",
        reason: "Lead already has an active sequence enrollment on a different pattern.",
      }),
    }
  }

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, { patternId: input.patternId })
  if (!preflight.allowed) {
    const blockedCodes = ["lead_blocked", "fatigue_blocked", "suppressed", "preflight_blocked"]
    const bucket = blockedCodes.includes(preflight.code ?? "") ? "skippedBlocked" : "failed"
    return {
      bucket,
      item: outcome(input.leadId, {
        code: preflight.code ?? "preflight_blocked",
        reason: preflight.reason ?? "Sequence enrollment blocked.",
      }),
    }
  }

  if (input.dryRun) {
    return {
      bucket: "enrolled",
      item: outcome(input.leadId, { code: "dry_run_would_enroll", reason: "Preflight passed — would enroll." }),
    }
  }

  try {
    const draft = await createGrowthSequenceEnrollmentDraft(admin, {
      leadId: input.leadId,
      patternId: input.patternId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      scheduledStartAt: input.scheduledStartAt,
      ownerUserId: input.ownerUserId ?? input.actingUserId,
    })

    if (!input.startImmediately) {
      return {
        bucket: "enrolled",
        item: outcome(input.leadId, { enrollmentId: draft.id, code: "draft_created" }),
      }
    }

    const confirmed = await confirmGrowthSequenceEnrollment(admin, {
      leadId: input.leadId,
      enrollmentId: draft.id,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })

    return {
      bucket: "enrolled",
      item: outcome(input.leadId, { enrollmentId: confirmed.id, code: "enrolled_active" }),
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "enrollment_failed"
    return {
      bucket: "failed",
      item: outcome(input.leadId, { code, reason: "Could not enroll lead in sequence." }),
    }
  }
}

export async function bulkEnrollLeadsInGrowthSequence(
  admin: SupabaseClient,
  input: {
    leadIds: string[]
    sequencePatternId: string
    startImmediately?: boolean
    scheduledStartAt?: string | null
    ownerUserId?: string | null
    actingUserId: string
    actingUserEmail: string
    dryRun?: boolean
  },
): Promise<BulkSequenceEnrollmentResult> {
  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === input.sequencePatternId)
  if (!pattern) throw new Error("pattern_not_found")

  const uniqueLeadIds = [...new Set(input.leadIds)]
  const startImmediately = input.startImmediately !== false
  const scheduledStartAt = input.scheduledStartAt ?? null
  const dryRun = input.dryRun === true

  const result: BulkSequenceEnrollmentResult = {
    qaMarker: GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
    sequencePatternId: input.sequencePatternId,
    dryRun,
    startImmediately,
    scheduledStartAt,
    requested: uniqueLeadIds.length,
    enrolled: [],
    skippedAlreadyEnrolled: [],
    skippedBlocked: [],
    failed: [],
  }

  for (const leadId of uniqueLeadIds) {
    const { bucket, item } = await enrollSingleLeadInGrowthSequence(admin, {
      leadId,
      patternId: input.sequencePatternId,
      startImmediately,
      scheduledStartAt,
      ownerUserId: input.ownerUserId ?? null,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      dryRun,
    })
    result[bucket].push(item)
  }

  logGrowthEngine("sequence_bulk_enrollment_completed", {
    qaMarker: GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
    sequencePatternId: input.sequencePatternId,
    dryRun,
    startImmediately,
    requested: result.requested,
    enrolled: result.enrolled.length,
    skippedAlreadyEnrolled: result.skippedAlreadyEnrolled.length,
    skippedBlocked: result.skippedBlocked.length,
    failed: result.failed.length,
  })

  return result
}
