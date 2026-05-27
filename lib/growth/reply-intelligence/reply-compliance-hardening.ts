import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateReplyCompliance } from "@/lib/growth/outbound/operational-compliance-hardening"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

const NON_POSITIVE_ENGAGEMENT = new Set(["out_of_office", "neutral_acknowledgement", "unknown"])

export async function applyReplyComplianceHardening(
  admin: SupabaseClient,
  input: {
    leadId: string
    replyId: string
    bodyPreview: string | null | undefined
    classification: ReplyIntentClassificationV2Result
    senderEmail?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<{ suppressFollowUp: boolean; urgentReview: boolean; violations: string[] }> {
  const compliance = await evaluateReplyCompliance(admin, {
    bodyPreview: input.bodyPreview,
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
  })

  const violations = compliance.violations.map((v) => v.message)
  let urgentReview = input.classification.intent === "angry_complaint"
  let suppressFollowUp = compliance.suppressFollowUp

  if (input.classification.intent === "out_of_office") {
    suppressFollowUp = false
    violations.push("Out-of-office reply excluded from positive engagement metrics.")
  }

  if (input.classification.intent === "referral") {
    violations.push("Referral reply flagged — do not auto-enroll referred contact.")
    urgentReview = true
  }

  if (input.classification.intent === "wrong_contact") {
    violations.push("Wrong-person reply — halt blind sequence continuation.")
    suppressFollowUp = true
    urgentReview = true
  }

  if (NON_POSITIVE_ENGAGEMENT.has(input.classification.intent)) {
    suppressFollowUp = suppressFollowUp || input.classification.intent === "neutral_acknowledgement"
  }

  if (urgentReview) {
    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "reply_workflow_routed",
      title: "Urgent reply compliance review",
      summary: violations.join(" "),
      outboundReplyId: input.replyId,
      payload: { urgent: true, intent: input.classification.intent },
    }).catch(() => undefined)
  }

  return { suppressFollowUp, urgentReview, violations }
}
