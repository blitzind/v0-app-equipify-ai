/** GE-AIOS-21C-4 — Legacy lead cleanup apply logic (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isConsumerEmailDomain, normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { updateGrowthLead } from "@/lib/growth/lead-repository"
import { upsertGrowthSuppressionEntry } from "@/lib/growth/outbound/suppression-repository"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildGrowthLeadAdmissionCleanupPlan,
  GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID,
  websiteNeedsAdmissionIdentityCleanup,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-cleanup-plan"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  type GrowthLeadAdmissionLeadRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"

export {
  buildGrowthLeadAdmissionCleanupPlan,
  GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN,
  GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-cleanup-plan"

export type GrowthLeadAdmissionCleanupApplyResult = {
  leadId: string
  applied: boolean
  skipped: boolean
  skipReason?: string
  changes: string[]
}

function mergeCleanupAudit(
  metadata: Record<string, unknown>,
  entry: Record<string, unknown>,
): Record<string, unknown> {
  const existing = Array.isArray(metadata.admission_cleanup_audit)
    ? (metadata.admission_cleanup_audit as Record<string, unknown>[])
    : []
  return {
    ...metadata,
    admission_cleanup_audit: [...existing, entry],
  }
}

export async function applyGrowthLeadAdmissionCleanup(input: {
  admin: SupabaseClient
  lead: GrowthLeadAdmissionLeadRow & { status: string; contact_email?: string | null }
  admissionContext: GrowthLeadAdmissionContext
  suppressed?: boolean
  generatedAt?: string
  operatorConfirmed?: boolean
}): Promise<GrowthLeadAdmissionCleanupApplyResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const metadata =
    input.lead.metadata && typeof input.lead.metadata === "object" ? { ...input.lead.metadata } : {}
  const plan = buildGrowthLeadAdmissionCleanupPlan({
    lead: input.lead,
    admissionContext: input.admissionContext,
    suppressed: input.suppressed,
  })

  if (plan.idempotent || plan.proposedChanges.length === 0) {
    return {
      leadId: input.lead.id,
      applied: false,
      skipped: true,
      skipReason: "already_clean",
      changes: [],
    }
  }

  if (!input.operatorConfirmed) {
    return {
      leadId: input.lead.id,
      applied: false,
      skipped: true,
      skipReason: "dry_run",
      changes: plan.proposedChanges,
    }
  }

  const intake = buildGrowthLeadAdmissionIntakeFromLead(input.lead)
  const evaluation = evaluateGrowthLeadAdmission(intake, input.admissionContext)
  const changes: string[] = []

  const patch: {
    companyName?: string
    website?: string | null
    status?: "disqualified" | "new"
    metadata?: Record<string, unknown>
  } = {}

  const admissionMetadata = buildLeadAdmissionMetadata(evaluation, generatedAt)
  const auditEntry = {
    script: GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID,
    previous_admission_state: metadata.admission_state ?? null,
    new_admission_state: evaluation.state,
    reasons: evaluation.reasons,
    cleanup_timestamp: generatedAt,
    operator_confirmed: true,
    proposed_changes: plan.proposedChanges,
  }

  patch.metadata = mergeCleanupAudit(
    {
      ...metadata,
      ...admissionMetadata,
      cleanup: "ge-aios-21c",
      requires_human_review: evaluation.requiresHumanReview,
    },
    auditEntry,
  )
  changes.push("admission metadata updated")

  if (websiteNeedsAdmissionIdentityCleanup(input.lead.website)) {
    patch.website = evaluation.sanitized.website
    changes.push("cleared consumer-domain website")
  }

  if (
    evaluation.state === "invalid" &&
    input.lead.company_name &&
    isConsumerEmailDomain(normalizeDomain(input.lead.company_name))
  ) {
    patch.companyName = evaluation.sanitized.companyName
    changes.push("sanitized consumer-domain company name")
  }

  if (evaluation.state === "invalid" || evaluation.state === "rejected") {
    if (input.lead.status !== "disqualified") {
      patch.status = "disqualified"
      changes.push("status → disqualified")
    }
  }

  await updateGrowthLead(input.admin, input.lead.id, patch)

  if (
    (evaluation.state === "invalid" || evaluation.state === "rejected") &&
    input.lead.contact_email?.trim()
  ) {
    await upsertGrowthSuppressionEntry(input.admin, {
      email: input.lead.contact_email,
      reason: "manual",
      source: "manual",
      leadId: input.lead.id,
      notes: `${GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID}:${evaluation.state}:${generatedAt}`,
    })
    changes.push("suppression entry ensured")
  }

  return {
    leadId: input.lead.id,
    applied: true,
    skipped: false,
    changes,
  }
}
