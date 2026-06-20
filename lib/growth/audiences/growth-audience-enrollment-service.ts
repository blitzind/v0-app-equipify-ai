import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  consumeAudienceEnrollmentBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import {
  getGrowthAudience,
  listGrowthAudienceMembers,
} from "@/lib/growth/audiences/growth-audience-repository"
import {
  bulkEnrollLeadsInGrowthSequence,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment"
import type { BulkSequenceEnrollmentResult } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import { recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

export type AudienceEnrollmentInput = {
  audienceId: string
  organizationId: string
  userId: string
  userEmail: string
  sequencePatternId: string
  snapshotId: string
  memberIds?: string[]
  enrollAll?: boolean
  startImmediately?: boolean
  dryRun?: boolean
}

export type AudienceEnrollmentResult = {
  qaMarker: typeof GROWTH_AUDIENCE_QA_MARKER
  audienceId: string
  snapshotId: string
  requested: number
  enrollable: number
  skippedNoLead: number
  bulk: BulkSequenceEnrollmentResult | null
  blocked?: boolean
  reason?: string
}

export async function enrollAudienceMembersInSequence(
  admin: SupabaseClient,
  input: AudienceEnrollmentInput,
): Promise<AudienceEnrollmentResult> {
  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }

  const { items: members, total } = await listGrowthAudienceMembers(admin, {
    snapshotId: input.snapshotId,
    limit: input.enrollAll ? GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT : 200,
    offset: 0,
  })

  let selected = members
  if (!input.enrollAll && input.memberIds?.length) {
    const idSet = new Set(input.memberIds)
    selected = members.filter((m) => idSet.has(m.id))
  }

  const withLead = selected.filter((m) => m.leadId)
  const skippedNoLead = selected.length - withLead.length
  const leadIds = [...new Set(withLead.map((m) => m.leadId!).filter(Boolean))]

  const cap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN
  const enrollableLeadIds = leadIds.slice(0, cap)

  if (enrollableLeadIds.length === 0) {
    return {
      qaMarker: GROWTH_AUDIENCE_QA_MARKER,
      audienceId: input.audienceId,
      snapshotId: input.snapshotId,
      requested: selected.length,
      enrollable: 0,
      skippedNoLead,
      bulk: null,
      reason: "no_enrollable_leads",
    }
  }

  const budget = await consumeAudienceEnrollmentBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    volume: enrollableLeadIds.length,
  })

  if (!budget.allowed) {
    return {
      qaMarker: GROWTH_AUDIENCE_QA_MARKER,
      audienceId: input.audienceId,
      snapshotId: input.snapshotId,
      requested: selected.length,
      enrollable: enrollableLeadIds.length,
      skippedNoLead,
      bulk: null,
      blocked: true,
      reason: budget.reason ?? "enrollment_budget_exceeded",
    }
  }

  try {
    const bulk = await bulkEnrollLeadsInGrowthSequence(admin, {
      leadIds: enrollableLeadIds,
      sequencePatternId: input.sequencePatternId,
      ownerUserId: input.userId,
      actingUserId: input.userId,
      actingUserEmail: input.userEmail,
      startImmediately: input.startImmediately ?? false,
      dryRun: input.dryRun ?? false,
    })

    await recordRuntimeHealthWrite(admin, enrollableLeadIds.length + 2)
    logGrowthEngine("audience_enrollment", {
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      audience_id: input.audienceId,
      snapshot_id: input.snapshotId,
      requested: selected.length,
      enrolled: bulk.enrolled.length,
      total_members: total,
    })

    return {
      qaMarker: GROWTH_AUDIENCE_QA_MARKER,
      audienceId: input.audienceId,
      snapshotId: input.snapshotId,
      requested: selected.length,
      enrollable: enrollableLeadIds.length,
      skippedNoLead,
      bulk,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "enrollment_failed"
    await recordAudienceGuardrailFailure(admin, message)
    throw error
  }
}
