import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  enrichBulkSequenceEnrollmentOutcome,
  fetchConflictingSequenceEnrollment,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-outcome"
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
  input?: Omit<BulkSequenceEnrollmentLeadOutcome, "leadId">,
): BulkSequenceEnrollmentLeadOutcome {
  return { leadId, ...input }
}

function leadLabelFromLead(lead: { companyName?: string | null; contactName?: string | null }): string | undefined {
  const company = lead.companyName?.trim()
  if (company) return company
  const contact = lead.contactName?.trim()
  if (contact) return contact
  return undefined
}

async function resolveExistingEnrollment(
  admin: SupabaseClient,
  leadId: string,
  patternId: string,
): Promise<
  | { kind: "none" }
  | { kind: "same_pattern"; enrollmentId: string; status: string }
  | { kind: "other_pattern"; enrollmentId: string; patternId: string; status: string }
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { kind: "none" }

  return {
    kind: "other_pattern",
    enrollmentId: String(data.id),
    patternId: String(data.sequence_pattern_id),
    status: String(data.status),
  }
}

async function buildActiveEnrollmentConflictOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    leadLabel?: string
    excludeEnrollmentId?: string | null
    reason?: string
  },
): Promise<BulkSequenceEnrollmentLeadOutcome> {
  const conflicting = await fetchConflictingSequenceEnrollment(admin, input.leadId, input.excludeEnrollmentId)
  const viewEnrollmentId = conflicting?.id ?? input.excludeEnrollmentId
  if (!viewEnrollmentId) {
    return outcome(input.leadId, {
      code: "active_enrollment",
      reason: input.reason ?? "Lead already has another sequence enrollment in progress.",
      leadLabel: input.leadLabel,
    })
  }

  return enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
    enrollmentId: viewEnrollmentId,
    conflictingEnrollmentId: conflicting?.id,
    code: "active_enrollment",
    reason:
      input.reason ??
      "Another sequence enrollment is blocking this action — continue from the existing enrollment.",
    leadLabel: input.leadLabel,
    suggestedAction: "view_enrollment",
  }))
}

async function handleSamePatternExistingEnrollment(
  admin: SupabaseClient,
  input: {
    leadId: string
    patternId: string
    startImmediately: boolean
    dryRun: boolean
    actingUserId: string
    actingUserEmail: string
    leadLabel?: string
    existing: { enrollmentId: string; status: string }
  },
): Promise<{ bucket: keyof Pick<BulkSequenceEnrollmentResult, "enrolled" | "skippedAlreadyEnrolled" | "skippedBlocked" | "failed">; item: BulkSequenceEnrollmentLeadOutcome }> {
  if (input.existing.status === "draft" && input.startImmediately && !input.dryRun) {
    try {
      const confirmed = await confirmGrowthSequenceEnrollment(admin, {
        leadId: input.leadId,
        enrollmentId: input.existing.enrollmentId,
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
      })
      return {
        bucket: "enrolled",
        item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
          enrollmentId: confirmed.id,
          code: "confirmed_existing_draft",
          leadLabel: input.leadLabel,
          enrollmentStatus: "active",
          schedulerEligible: true,
        })),
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "confirm_failed"
      if (code === "active_enrollment") {
        return {
          bucket: "skippedAlreadyEnrolled",
          item: await buildActiveEnrollmentConflictOutcome(admin, {
            leadId: input.leadId,
            leadLabel: input.leadLabel,
            excludeEnrollmentId: input.existing.enrollmentId,
          }),
        }
      }

      return {
        bucket: "skippedAlreadyEnrolled",
        item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
          enrollmentId: input.existing.enrollmentId,
          code,
          reason:
            code === "preflight_blocked"
              ? "Could not activate the draft enrollment because preflight blocked it."
              : "Could not activate the draft enrollment — continue from the existing draft.",
          leadLabel: input.leadLabel,
          suggestedAction: "view_enrollment",
        })),
      }
    }
  }

  const reason =
    input.existing.status === "draft"
      ? "Draft enrollment already exists for this sequence — continue from it or cancel to retry."
      : input.existing.status === "paused"
        ? "Enrollment is paused — resume it to continue scheduling."
        : "Lead is already enrolled in this sequence."

  return {
    bucket: "skippedAlreadyEnrolled",
    item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
      enrollmentId: input.existing.enrollmentId,
      code: input.existing.status === "paused" ? "paused_enrollment" : "already_enrolled",
      reason,
      leadLabel: input.leadLabel,
    })),
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

  const label = leadLabelFromLead(lead)

  const existing = await resolveExistingEnrollment(admin, input.leadId, input.patternId)
  if (existing.kind === "same_pattern") {
    return handleSamePatternExistingEnrollment(admin, {
      leadId: input.leadId,
      patternId: input.patternId,
      startImmediately: input.startImmediately,
      dryRun: input.dryRun,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      leadLabel: label,
      existing: { enrollmentId: existing.enrollmentId, status: existing.status },
    })
  }

  if (existing.kind === "other_pattern") {
    return {
      bucket: "skippedBlocked",
      item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
        enrollmentId: existing.enrollmentId,
        code: "active_enrollment",
        reason: "Lead already has a sequence enrollment on a different pattern.",
        leadLabel: label,
        suggestedAction: "view_enrollment",
      })),
    }
  }

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, { patternId: input.patternId })
  if (!preflight.allowed) {
    if (preflight.code === "active_enrollment") {
      return {
        bucket: "skippedAlreadyEnrolled",
        item: await buildActiveEnrollmentConflictOutcome(admin, {
          leadId: input.leadId,
          leadLabel: label,
          reason: preflight.reason,
        }),
      }
    }

    const blockedCodes = ["lead_blocked", "fatigue_blocked", "suppressed", "preflight_blocked"]
    const bucket = blockedCodes.includes(preflight.code ?? "") ? "skippedBlocked" : "failed"
    return {
      bucket,
      item: outcome(input.leadId, {
        code: preflight.code ?? "preflight_blocked",
        reason: preflight.reason ?? "Sequence enrollment blocked.",
        leadLabel: label,
      }),
    }
  }

  if (input.dryRun) {
    return {
      bucket: "enrolled",
      item: outcome(input.leadId, { code: "dry_run_would_enroll", reason: "Preflight passed — would enroll.", leadLabel: label }),
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
        item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
          enrollmentId: draft.id,
          code: "draft_created",
          leadLabel: label,
        })),
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
      item: await enrichBulkSequenceEnrollmentOutcome(admin, input.leadId, outcome(input.leadId, {
        enrollmentId: confirmed.id,
        code: "enrolled_active",
        leadLabel: label,
        enrollmentStatus: "active",
        schedulerEligible: true,
      })),
    }
    } catch (error) {
      const code = error instanceof Error ? error.message : "enrollment_failed"
      void (async () => {
        try {
          const { fanInGrowthObjectiveSequenceEvent } = await import(
            "@/lib/growth/objectives/growth-objective-sequence-fan-in"
          )
          await fanInGrowthObjectiveSequenceEvent(admin, {
            leadId: input.leadId,
            signalType: "enrollment_failed",
            enrollmentId: input.leadId,
            sequencePatternId: input.patternId ?? null,
            metadata: { code },
          })
        } catch {
          // Best-effort objective fan-in.
        }
      })()
      if (code === "active_enrollment") {
      return {
        bucket: "skippedAlreadyEnrolled",
        item: await buildActiveEnrollmentConflictOutcome(admin, {
          leadId: input.leadId,
          leadLabel: label,
        }),
      }
    }

    return {
      bucket: "failed",
      item: outcome(input.leadId, { code, reason: "Could not enroll lead in sequence.", leadLabel: label }),
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
