import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPreSendSuppressionResult } from "@/lib/growth/compliance/compliance-types"
import { evaluatePreSendSuppression } from "@/lib/growth/compliance/suppression-engine"
import { evaluatePreSendInfrastructureAllowed } from "@/lib/growth/compliance/pre-send-infrastructure-guards"
import { isEmailSuppressed } from "@/lib/growth/outbound/suppression-repository"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "@/lib/growth/operations/internal-outbound-ops-types"
import { maybeApplyGrowthQaDeliverabilityInfrastructureBypass } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass"
import type { GrowthQaDeliverabilityBypassSnapshot } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"

export const GROWTH_PRE_SEND_ASSERTION_QA_MARKER = GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER

export type GrowthPreSendAssertionInput = {
  email: string
  leadId?: string | null
  senderAccountId?: string
  senderPoolId?: string | null
  skipInfrastructureChecks?: boolean
  qaDeliverabilityBypass?: GrowthQaDeliverabilityBypassSnapshot | null
  actingUserEmail?: string | null
  actingUserId?: string | null
}

export type GrowthPreSendAssertionResult = GrowthPreSendSuppressionResult & {
  blockLayer: "compliance" | "outbound_suppression" | "infrastructure" | null
  infrastructureBlockCode?: string | null
}

/** Unified read/evaluation layer: compliance → outbound suppression → infrastructure guards. */
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

  if (input.senderAccountId && !input.skipInfrastructureChecks) {
    const infrastructure = await evaluatePreSendInfrastructureAllowed(admin, {
      senderAccountId: input.senderAccountId,
      senderPoolId: input.senderPoolId,
      recipientEmail: input.email,
    })

    if (!infrastructure.allowed) {
      const bypassDecision = await maybeApplyGrowthQaDeliverabilityInfrastructureBypass({
        admin,
        bypass: input.qaDeliverabilityBypass,
        infrastructureBlockCode: infrastructure.blockCode,
        actingUserEmail: input.actingUserEmail,
        actingUserId: input.actingUserId,
      })

      if (bypassDecision.bypassApplied) {
        return { allowed: true, reason: null, blockCode: null, blockLayer: null }
      }

      await recordInternalOutboundAuditEvent(admin, {
        eventType: "pre_send_blocked",
        severity: "high",
        title: "Pre-send blocked by infrastructure guard",
        summary: infrastructure.reason,
        senderAccountId: input.senderAccountId,
        metadata: { block_code: infrastructure.blockCode, recipient: input.email },
      }).catch(() => undefined)

      return {
        allowed: false,
        reason: infrastructure.reason,
        blockCode: "suppression",
        blockLayer: "infrastructure",
        infrastructureBlockCode: infrastructure.blockCode,
      }
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
