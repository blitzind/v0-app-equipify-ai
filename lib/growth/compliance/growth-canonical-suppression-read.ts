/** GE-AIOS-23 — Canonical suppression read path (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_CANONICAL_SUPPRESSION_READ_QA_MARKER } from "@/lib/growth/compliance/growth-canonical-suppression-types"
import { evaluatePreSendSuppression } from "@/lib/growth/compliance/suppression-engine"
import { isEmailSuppressed as isLegacyEmailSuppressed } from "@/lib/growth/outbound/suppression-repository"

export { GROWTH_CANONICAL_SUPPRESSION_READ_QA_MARKER } from "@/lib/growth/compliance/growth-canonical-suppression-types"

export type GrowthCanonicalSuppressionReadResult = {
  suppressed: boolean
  layer: "compliance" | "legacy_outbound" | null
  reason: string | null
  blockCode: string | null
}

/** Single eligibility read: compliance engine first, legacy outbound table second. */
export async function evaluateCanonicalRecipientSuppression(
  admin: SupabaseClient,
  input: { email: string; leadId?: string | null; senderAccountId?: string | null },
): Promise<GrowthCanonicalSuppressionReadResult> {
  const compliance = await evaluatePreSendSuppression(admin, {
    email: input.email,
    leadId: input.leadId ?? null,
    senderAccountId: input.senderAccountId ?? undefined,
  })

  if (!compliance.allowed) {
    return {
      suppressed: true,
      layer: "compliance",
      reason: compliance.reason,
      blockCode: compliance.blockCode,
    }
  }

  if (await isLegacyEmailSuppressed(admin, input.email)) {
    return {
      suppressed: true,
      layer: "legacy_outbound",
      reason: "Recipient is on the outbound suppression list.",
      blockCode: "suppression",
    }
  }

  return { suppressed: false, layer: null, reason: null, blockCode: null }
}
