import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPreSendSuppressionResult } from "@/lib/growth/compliance/compliance-types"
import { evaluatePreSendSuppression } from "@/lib/growth/compliance/suppression-engine"
import { isEmailSuppressed } from "@/lib/growth/outbound/suppression-repository"

export const GROWTH_PRE_SEND_ASSERTION_QA_MARKER = "growth-operational-send-plane-v1" as const

export type GrowthPreSendAssertionInput = {
  email: string
  leadId?: string | null
  senderAccountId?: string
}

export type GrowthPreSendAssertionResult = GrowthPreSendSuppressionResult & {
  blockLayer: "compliance" | "outbound_suppression" | null
}

/** Unified read/evaluation layer across compliance + outbound suppression tables. */
export async function evaluatePreSendAllowed(
  admin: SupabaseClient,
  input: GrowthPreSendAssertionInput,
): Promise<GrowthPreSendAssertionResult> {
  const compliance = await evaluatePreSendSuppression(admin, {
    email: input.email,
    leadId: input.leadId,
    senderAccountId: input.senderAccountId,
  })

  if (!compliance.allowed) {
    return { ...compliance, blockLayer: "compliance" }
  }

  if (await isEmailSuppressed(admin, input.email)) {
    return {
      allowed: false,
      reason: "Recipient is on the outbound suppression list.",
      blockCode: "suppression",
      blockLayer: "outbound_suppression",
    }
  }

  return { allowed: true, reason: null, blockCode: null, blockLayer: null }
}

/** Canonical pre-send gate for transport, sequences, outreach, and manual sends. */
export async function assertPreSendAllowed(
  admin: SupabaseClient,
  input: GrowthPreSendAssertionInput & { senderAccountId: string },
): Promise<GrowthPreSendAssertionResult> {
  return evaluatePreSendAllowed(admin, input)
}
