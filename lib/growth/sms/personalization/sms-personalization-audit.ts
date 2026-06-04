/** Growth Engine Phase 5.3A — SMS messaging audit (client-safe). */

export const GROWTH_SMS_PERSONALIZATION_QA_MARKER = "growth-sms-personalization-v1" as const

export const SMS_TRANSFERS_FROM_EMAIL = [
  "OutreachContextPacket / buildOutreachContextPacket — research, memory, angles, objections",
  "research-evidence-selection — evidence ranking",
  "memory-strategy — thresholds, relationship stage, open loops",
  "context-utilization + memory-utilization — audit percentages",
  "Research-backed evidence sources (website, pain, angles)",
  "Memory-backed openers (commitments, open loops, objections)",
  "CTA philosophy — questions over meetings on cold; warm scheduling when earned",
  "personalization-warnings confidence pattern",
] as const

export const SMS_DO_NOT_TRANSFER_FROM_EMAIL = [
  "Subject intelligence — SMS has no subject line",
  "5-block email structure (opening, pain, industry, proof, cta)",
  "120-word / paragraph assembly",
  "Email greetings (Hi {{name}} — long intros)",
  "Meeting CTAs on cold first touch",
  "Proof blocks and industry paragraphs",
  "AI refinement with email word limits",
  "Mailbox / sequence email-specific context (prior_subjects as primary hook)",
] as const

export type GrowthSmsPersonalizationArchitectureAudit = {
  qa_marker: typeof GROWTH_SMS_PERSONALIZATION_QA_MARKER
  transfersFromEmail: readonly string[]
  doNotTransfer: readonly string[]
  architectureMap: {
    context: string
    opener: string
    cta: string
    memory: string
    quality: string
    inbox: string
  }
}

export function buildGrowthSmsPersonalizationArchitectureAudit(): GrowthSmsPersonalizationArchitectureAudit {
  return {
    qa_marker: GROWTH_SMS_PERSONALIZATION_QA_MARKER,
    transfersFromEmail: SMS_TRANSFERS_FROM_EMAIL,
    doNotTransfer: SMS_DO_NOT_TRANSFER_FROM_EMAIL,
    architectureMap: {
      context: "buildSmsPersonalizationContext → buildOutreachContextPacket + SMS short-form projection",
      opener: "selectSmsOpeningHook — research question | pain question | memory continuation | follow-up | check-in",
      cta: "buildSmsCta — quick question | yes/no | clarification | scheduling (warm) | commitment continuation",
      memory: "memory-strategy + sms-memory-hook — ongoing conversation tone, avoid blast language",
      quality: "scoreSmsPersonalizationQuality — char fit, specificity, memory/context utilization",
      inbox: "buildSmsInboxDraftSuggestion → Action Center embed (human approval, no auto-send)",
    },
  }
}
