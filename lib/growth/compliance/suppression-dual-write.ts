import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyDeliverySuppression } from "@/lib/growth/compliance/suppression-engine"
import { normalizeEmail } from "@/lib/growth/import/normalize"
import type { GrowthSuppressionReason, GrowthSuppressionSource } from "@/lib/growth/outbound/types"

export const GROWTH_SUPPRESSION_DUAL_WRITE_QA_MARKER = "growth-suppression-dual-write-v1"

const LEGACY_TO_COMPLIANCE_REASON: Record<GrowthSuppressionReason, string> = {
  unsubscribe: "Unsubscribe (global)",
  bounce_hard: "Hard bounce (hard)",
  spam_complaint: "Complaint (spam_complaint)",
  manual: "Manual suppression",
  legal: "Legal hold",
}

export function isGrowthSuppressionDualWriteEnabled(): boolean {
  return process.env.GROWTH_SUPPRESSION_DUAL_WRITE?.trim().toLowerCase() === "true"
}

export function mapLegacySuppressionReasonToComplianceReason(reason: GrowthSuppressionReason): string {
  return LEGACY_TO_COMPLIANCE_REASON[reason]
}

type DualWriteMirrorLog = {
  event: "growth_suppression_dual_write_mirror"
  legacy_reason: GrowthSuppressionReason
  canonical_reason: string | null
  email_present: boolean
  success: boolean
  failure_reason: string | null
  legacy_source: GrowthSuppressionSource
}

function logDualWriteMirrorEvent(input: Omit<DualWriteMirrorLog, "event">): void {
  if (!isGrowthSuppressionDualWriteEnabled()) return
  console.debug(JSON.stringify({ event: "growth_suppression_dual_write_mirror", ...input }))
}

export async function mirrorLegacySuppressionToCompliance(
  admin: SupabaseClient,
  input: {
    email: string
    reason: GrowthSuppressionReason
    source: GrowthSuppressionSource
    leadId?: string | null
    contactId?: string | null
    suppressedAt?: string | null
    expiresAt?: string | null
  },
): Promise<void> {
  if (!isGrowthSuppressionDualWriteEnabled()) return

  const normalized = normalizeEmail(input.email)
  const canonicalReason = mapLegacySuppressionReasonToComplianceReason(input.reason)

  try {
    if (!normalized) {
      logDualWriteMirrorEvent({
        legacy_reason: input.reason,
        canonical_reason: canonicalReason,
        email_present: false,
        success: false,
        failure_reason: "invalid_email",
        legacy_source: input.source,
      })
      return
    }

    await applyDeliverySuppression(admin, {
      email: normalized,
      leadId: input.leadId ?? null,
      reason: canonicalReason,
      expiresAt: input.expiresAt ?? null,
    })

    logDualWriteMirrorEvent({
      legacy_reason: input.reason,
      canonical_reason: canonicalReason,
      email_present: true,
      success: true,
      failure_reason: null,
      legacy_source: input.source,
    })
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)
    logDualWriteMirrorEvent({
      legacy_reason: input.reason,
      canonical_reason: canonicalReason,
      email_present: Boolean(normalized),
      success: false,
      failure_reason: failureReason.slice(0, 200),
      legacy_source: input.source,
    })
  }
}
