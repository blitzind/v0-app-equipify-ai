/** Deterministic outbound provider — Phase 5A default. */

import {
  buildOutboundAiDisclosure,
  buildOutboundSilenceFallback,
  buildVoicemailScript,
  sanitizeOutboundResponse,
} from "@/lib/voice/ai-outbound/guardrails"
import type {
  OutboundProviderContext,
  OutboundProviderResponse,
  VoiceAiOutboundProvider,
} from "@/lib/voice/ai-outbound/provider-types"

function workflowLabel(workflowType: OutboundProviderContext["workflowType"]): string {
  switch (workflowType) {
    case "missed_call_callback":
      return "your recent missed call"
    case "voicemail_followup":
      return "your voicemail message"
    case "appointment_confirmation":
      return "your upcoming appointment"
    case "appointment_reminder":
      return "your scheduled appointment"
    case "qualification_callback":
      return "your service inquiry"
    case "after_hours_followup":
      return "your after-hours inquiry"
    case "warm_reengagement":
      return "your recent conversation with our team"
    default:
      return "your request"
  }
}

export class DeterministicOutboundProvider implements VoiceAiOutboundProvider {
  id = "deterministic" as const

  isConfigured(): boolean {
    return true
  }

  async generateResponse(context: OutboundProviderContext): Promise<OutboundProviderResponse> {
    const start = Date.now()
    let text = ""

    if (context.voicemailMode) {
      text = buildVoicemailScript({
        organizationName: context.organizationName,
        callbackNumber: null,
        workflowLabel: workflowLabel(context.workflowType),
      })
    } else if (!context.calleeText.trim()) {
      text = buildOutboundSilenceFallback()
    } else if (context.phase === "opening") {
      const disclosure = buildOutboundAiDisclosure(context.organizationName)
      text = `${disclosure}I'm following up regarding ${workflowLabel(context.workflowType)}. Is now a good time?`
    } else if (context.qualificationPrompt) {
      text = context.qualificationPrompt
    } else if (context.schedulingPrompt) {
      text = context.schedulingPrompt
    } else if (context.phase === "scheduling") {
      text =
        "I can help coordinate scheduling. Our team will confirm the final time — would mornings or afternoons work better?"
    } else if (context.phase === "callback_offer") {
      text = "Would you prefer a callback from a team member, or should I note a preferred time?"
    } else if (context.phase === "escalation") {
      text = "I'll connect you with a team member who can help further. One moment please."
    } else if (context.phase === "closing") {
      text = "Thank you. A team member will follow up if needed. Have a great day."
    } else {
      text =
        context.messagePreview?.trim() ||
        "Thank you for your time. Our team will follow up with any next steps."
    }

    const sanitized = sanitizeOutboundResponse(text)
    return {
      spokenText: sanitized.text,
      evidenceText: sanitized.violations.length
        ? `Guardrails: ${sanitized.violations.map((v) => v.code).join(", ")}`
        : `Deterministic outbound response for phase ${context.phase}`,
      latencyMs: Date.now() - start,
      providerId: "deterministic",
    }
  }
}

export const deterministicOutboundProvider = new DeterministicOutboundProvider()
