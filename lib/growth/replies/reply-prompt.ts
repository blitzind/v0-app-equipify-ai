import type { GrowthReplyDraftContext, GrowthReplyDraftType } from "@/lib/growth/replies/reply-draft-types"

export function buildReplyDraftSystemPrompt(context: GrowthReplyDraftContext): string {
  return [
    "You are Growth Engine reply drafting assistant.",
    "Generate a concise, professional email reply draft for human review.",
    "Never send autonomously. Never include secrets or internal identifiers.",
    "Respect compliance flags and unsubscribe intent.",
    "When approved reply_draft templates exist in Content Library, align tone and structure — templates require human approval before live send.",
    `Draft type: ${context.draftType}`,
    `Classification: ${context.classification}`,
    context.complianceFlags.length > 0 ? `Compliance flags: ${context.complianceFlags.join(", ")}` : "",
    context.playbookInfluence.length > 0
      ? `Approved playbook influence:\n- ${context.playbookInfluence.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildReplyDraftUserPrompt(context: GrowthReplyDraftContext): string {
  return [
    `Company: ${context.companyLabel}`,
    `Contact: ${context.contactLabel}`,
    `Thread subject: ${context.threadSubject}`,
    `Inbound preview: ${context.inboundPreview}`,
    context.engagementSummary ? `Engagement: ${context.engagementSummary}` : "",
    context.marketSignals.length > 0 ? `Signals: ${context.marketSignals.join("; ")}` : "",
    context.sequenceActive ? "Active sequence enrollment — recommend human review before sequence changes." : "",
    "Return JSON with subject (optional), content (body), classification.primary, classification.confidence (0-1), tone.",
  ]
    .filter(Boolean)
    .join("\n")
}

export function fallbackReplyDraft(context: GrowthReplyDraftContext): {
  subject: string
  body: string
  tone: string
  confidence: number
} {
  const templates: Record<GrowthReplyDraftType, string> = {
    positive_interest_reply: `Hi ${context.contactLabel},\n\nThank you for your interest. I'd be happy to share more details and answer any questions.\n\nBest regards`,
    objection_reply: `Hi ${context.contactLabel},\n\nThanks for sharing your concerns. I understand timing and budget matter — happy to provide options that fit your situation.\n\nBest regards`,
    meeting_booking_reply: `Hi ${context.contactLabel},\n\nA call sounds great. Please share a few times that work for you and I'll send a calendar invite.\n\nBest regards`,
    not_interested_acknowledgement: `Hi ${context.contactLabel},\n\nUnderstood — thank you for letting us know. We'll close the loop on our side.\n\nBest regards`,
    referral_reply: `Hi ${context.contactLabel},\n\nThank you for the referral pointer. We appreciate you connecting us with the right contact.\n\nBest regards`,
    question_answer_reply: `Hi ${context.contactLabel},\n\nGreat question. Here's a concise answer based on what we discussed. Happy to clarify further if helpful.\n\nBest regards`,
    generic_follow_up_reply: `Hi ${context.contactLabel},\n\nFollowing up on your message. Let me know if you'd like to continue the conversation.\n\nBest regards`,
  }

  return {
    subject: context.threadSubject.startsWith("Re:") ? context.threadSubject : `Re: ${context.threadSubject}`,
    body: templates[context.draftType],
    tone: "professional",
    confidence: 55,
  }
}
