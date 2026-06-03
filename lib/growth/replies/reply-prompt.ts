import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  applyAvoidRepeatingToReplyDraft,
  buildMemoryAwareSuggestedReplyDraft,
  formatRelationshipMemoryForReplyPrompt,
} from "@/lib/growth/reply-intelligence/reply-copilot-memory"
import type { GrowthReplyDraftContext, GrowthReplyDraftType } from "@/lib/growth/replies/reply-draft-types"

const DRAFT_TYPE_INTENT: Record<GrowthReplyDraftType, GrowthReplyIntent> = {
  positive_interest_reply: "positive_interest",
  objection_reply: "objection",
  meeting_booking_reply: "demo_request",
  not_interested_acknowledgement: "not_interested",
  referral_reply: "referral",
  question_answer_reply: "question",
  generic_follow_up_reply: "generic_follow_up",
}

function replyCopilotMemoryFromContext(context: GrowthReplyDraftContext) {
  if (!context.relationshipMemory?.available) return undefined
  return {
    relationshipSummary: context.relationshipMemory.relationshipSummary,
    topObjections: context.relationshipMemory.topObjections,
    topPreferences: context.relationshipMemory.topPreferences,
    avoidRepeating: context.relationshipMemory.avoidRepeatingTopics,
    commitmentSummaries: context.relationshipMemory.commitments,
  }
}

export function buildReplyDraftSystemPrompt(context: GrowthReplyDraftContext): string {
  const memoryLines = formatRelationshipMemoryForReplyPrompt(context.relationshipMemory)
  return [
    "You are Growth Engine reply drafting assistant.",
    "Generate a concise, professional email reply draft for human review.",
    "Never send autonomously. Never include secrets or internal identifiers.",
    "Respect compliance flags and unsubscribe intent.",
    "When relationship memory is present, honor known objections and preferences.",
    "Do not re-ask questions covered by avoidRepeatingTopics or prior interactions.",
    "When approved reply_draft templates exist in Content Library, align tone and structure — templates require human approval before live send.",
    `Draft type: ${context.draftType}`,
    `Classification: ${context.classification}`,
    context.complianceFlags.length > 0 ? `Compliance flags: ${context.complianceFlags.join(", ")}` : "",
    context.playbookInfluence.length > 0
      ? `Approved playbook influence:\n- ${context.playbookInfluence.join("\n- ")}`
      : "",
    memoryLines.length > 0 ? memoryLines.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildReplyDraftUserPrompt(context: GrowthReplyDraftContext): string {
  const memoryLines = formatRelationshipMemoryForReplyPrompt(context.relationshipMemory)
  return [
    `Company: ${context.companyLabel}`,
    `Contact: ${context.contactLabel}`,
    `Thread subject: ${context.threadSubject}`,
    `Inbound preview: ${context.inboundPreview}`,
    context.engagementSummary ? `Engagement: ${context.engagementSummary}` : "",
    context.marketSignals.length > 0 ? `Signals: ${context.marketSignals.join("; ")}` : "",
    context.sequenceActive ? "Active sequence enrollment — recommend human review before sequence changes." : "",
    memoryLines.length > 0 ? `\n${memoryLines.join("\n")}` : "",
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
  const memory = replyCopilotMemoryFromContext(context)
  const intent = DRAFT_TYPE_INTENT[context.draftType] ?? "generic_follow_up"

  if (context.draftType === "not_interested_acknowledgement") {
    return {
      subject: context.threadSubject.startsWith("Re:") ? context.threadSubject : `Re: ${context.threadSubject}`,
      body: `Hi ${context.contactLabel},\n\nUnderstood — thank you for letting us know. We'll close the loop on our side.\n\nBest regards`,
      tone: "professional",
      confidence: 55,
    }
  }

  if (context.draftType === "referral_reply") {
    return {
      subject: context.threadSubject.startsWith("Re:") ? context.threadSubject : `Re: ${context.threadSubject}`,
      body: `Hi ${context.contactLabel},\n\nThank you for the referral pointer. We appreciate you connecting us with the right contact.\n\nBest regards`,
      tone: "professional",
      confidence: 55,
    }
  }

  const bodyObjectionDraft =
    context.draftType === "objection_reply"
      ? `Hi ${context.contactLabel},\n\nThanks for sharing your concerns. I understand timing and budget matter — happy to provide options that fit your situation.\n\nBest regards`
      : context.draftType === "meeting_booking_reply" && !memory
        ? `Hi ${context.contactLabel},\n\nA call sounds great. Please share a few times that work for you and I'll send a calendar invite.\n\nBest regards`
        : context.draftType === "question_answer_reply" && !memory
          ? `Hi ${context.contactLabel},\n\nGreat question. Here's a concise answer based on what we discussed. Happy to clarify further if helpful.\n\nBest regards`
          : null

  const body = buildMemoryAwareSuggestedReplyDraft({
    contactLabel: context.contactLabel,
    intent,
    bodyObjectionDraft,
    relationshipMemory: memory,
  })

  return {
    subject: context.threadSubject.startsWith("Re:") ? context.threadSubject : `Re: ${context.threadSubject}`,
    body:
      context.draftType === "question_answer_reply" && memory
        ? applyAvoidRepeatingToReplyDraft(body, memory.avoidRepeating)
        : body,
    tone: "professional",
    confidence: memory ? 62 : 55,
  }
}
