import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthAiCopilotRules } from "@/lib/growth/ai-copilot-repository"
import { evaluateGrowthAiCopilotRules } from "@/lib/growth/ai-copilot-rules"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"
import type { GrowthOutreachQueueChannel } from "@/lib/growth/outreach/outreach-queue-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthQaDeliverabilityBypassSnapshot } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import { evaluateGrowthQaDeliverabilityBypass } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass"

export type OutreachPreflightResult = {
  allowed: boolean
  reason?: string
  code?: string
}

async function resolveOutreachPreflightSenderAccountId(
  admin: SupabaseClient,
  senderAccountId?: string | null,
): Promise<string | null> {
  if (senderAccountId) return senderAccountId
  const { resolveSequenceExecutionSender } = await import(
    "@/lib/growth/sequences/execution/sequence-send-builder"
  )
  const sender = await resolveSequenceExecutionSender(admin)
  return sender?.senderAccountId ?? null
}

export async function runGrowthOutreachPreflight(
  admin: SupabaseClient,
  input: {
    lead: GrowthLead
    channel: GrowthOutreachQueueChannel
    toEmail?: string | null
    generationType?: GrowthAiCopilotGenerationType | null
    generationApproved?: boolean
    senderAccountId?: string | null
    actingUserEmail?: string | null
    actingUserId?: string | null
    qaDeliverabilityBypass?: GrowthQaDeliverabilityBypassSnapshot | null
    enrollmentId?: string | null
  },
): Promise<OutreachPreflightResult> {
  if (input.generationType && !input.generationApproved) {
    return { allowed: false, code: "generation_not_approved", reason: "AI draft must be approved before queueing." }
  }

  if (input.channel === "email") {
    const email = input.toEmail ?? input.lead.contactEmail
    if (!email?.trim()) {
      return { allowed: false, code: "missing_email", reason: "Lead email required for email outreach." }
    }

    const senderAccountId = await resolveOutreachPreflightSenderAccountId(admin, input.senderAccountId)
    const qaDeliverabilityBypass =
      input.qaDeliverabilityBypass ??
      (input.actingUserEmail
        ? await evaluateGrowthQaDeliverabilityBypass(admin, {
            actingUserEmail: input.actingUserEmail,
            recipientEmail: email,
            senderAccountId,
            enrollmentId: input.enrollmentId ?? null,
          })
        : null)

    const suppression = await assertEmailSendAllowed(admin, email, {
      leadId: input.lead.id,
      senderAccountId: senderAccountId ?? undefined,
      qaDeliverabilityBypass,
      actingUserEmail: input.actingUserEmail,
      actingUserId: input.actingUserId,
    })
    if (!suppression.allowed) {
      return {
        allowed: false,
        code: suppression.blockLayer === "infrastructure" ? "reputation_blocked" : "suppressed",
        reason: suppression.reason ?? "Lead email is suppressed.",
      }
    }

    const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, input.lead.id, email)
    const rules = await listGrowthAiCopilotRules(admin)
    const generationType = input.generationType ?? "follow_up_email"
    const ruleCheck = evaluateGrowthAiCopilotRules({
      lead: input.lead,
      generationType,
      rules,
      emailSummary,
    })
    if (!ruleCheck.allowed) {
      return { allowed: false, code: "rule_blocked", reason: ruleCheck.reason ?? "Outreach blocked by governance rules." }
    }

    if (input.lead.opportunityBlockers.some((blocker) => blocker.key === "suppressed")) {
      return { allowed: false, code: "suppressed", reason: "Lead is suppressed." }
    }

    const tier = input.lead.operationalCapacityTier
    const recommendation = input.lead.capacityProtectionRecommendation ?? ""
    if (tier === "critical" && recommendation.toLowerCase().includes("reduce new outreach")) {
      return {
        allowed: false,
        code: "capacity_blocked",
        reason: "Operational capacity is critical — email outreach blocked.",
      }
    }
  }

  return { allowed: true }
}

export function outreachPreflightRequiresCapacityConfirm(lead: GrowthLead): boolean {
  return (
    lead.operationalCapacityTier === "strained" &&
    (lead.capacityProtectionRecommendation ?? "").toLowerCase().includes("defer new outreach")
  )
}
