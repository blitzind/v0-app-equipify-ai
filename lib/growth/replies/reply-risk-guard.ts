import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import type { GrowthReplyDraftRiskLevel, GrowthReplyRiskGuardResult } from "@/lib/growth/replies/reply-draft-types"

export async function evaluateReplyRiskGuard(
  admin: SupabaseClient,
  input: {
    leadId: string
    recipientEmail?: string | null
    threadStatus: string
    hasInboundMessage: boolean
    classification?: string | null
    allowResolvedThread?: boolean
  },
): Promise<GrowthReplyRiskGuardResult> {
  if (!input.hasInboundMessage) {
    return { allowed: false, riskLevel: "blocked", blockCode: "no_inbound_context", message: "No inbound message context." }
  }

  if (["archived", "resolved"].includes(input.threadStatus) && !input.allowResolvedThread) {
    return {
      allowed: false,
      riskLevel: "blocked",
      blockCode: "thread_closed",
      message: "Thread is archived or resolved.",
    }
  }

  if (input.classification === "unsubscribe") {
    return {
      allowed: false,
      riskLevel: "blocked",
      blockCode: "unsubscribe_detected",
      message: "Unsubscribe detected on thread.",
    }
  }

  const email = input.recipientEmail?.trim()
  if (email) {
    const summary = await fetchGrowthLeadEmailEventSummary(admin, input.leadId, email)
    if (summary.suppressed) {
      return { allowed: false, riskLevel: "blocked", blockCode: "suppressed", message: "Lead or email is suppressed." }
    }
    if (summary.unsubscribed) {
      return { allowed: false, riskLevel: "blocked", blockCode: "unsubscribed", message: "Recipient unsubscribed." }
    }
    if (summary.complaint) {
      return { allowed: false, riskLevel: "blocked", blockCode: "complaint_detected", message: "Complaint detected." }
    }
    if (summary.hardBounce) {
      return { allowed: false, riskLevel: "blocked", blockCode: "hard_bounce_detected", message: "Hard bounce detected." }
    }
  }

  let riskLevel: GrowthReplyDraftRiskLevel = "low"
  if (input.classification === "competitor" || input.classification === "budget") riskLevel = "medium"
  if (input.classification === "not_interested") riskLevel = "high"

  return { allowed: true, riskLevel }
}

export function assertReplyDraftApproved(input: {
  status: string
  requiresHumanReview: boolean
  humanApproved?: boolean
  humanApprovalConfirmed?: boolean
}): void {
  if (input.status !== "approved") throw new Error("draft_not_approved")
  if (input.requiresHumanReview && (!input.humanApproved || !input.humanApprovalConfirmed)) {
    throw new Error("human_approval_confirmed_required")
  }
}
