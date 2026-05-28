/** Deterministic receptionist provider — Phase 4A default. */

import {
  buildAiDisclosurePrefix,
  buildSilenceFallbackResponse,
  sanitizeReceptionistResponse,
} from "@/lib/voice/ai-receptionist/guardrails"
import type {
  ReceptionistProviderContext,
  ReceptionistProviderResponse,
  VoiceAiReceptionistProvider,
} from "@/lib/voice/ai-receptionist/provider-types"
import { VOICE_AI_RECEPTIONIST_AI_DISCLOSURE_ENABLED } from "@/lib/voice/ai-receptionist/types"

function buildGreeting(context: ReceptionistProviderContext): string {
  const disclosure = buildAiDisclosurePrefix(VOICE_AI_RECEPTIONIST_AI_DISCLOSURE_ENABLED)
  const name = context.relationshipSummary ? ` Welcome back.` : ""
  if (context.afterHours) {
    return `${disclosure}Thank you for calling.${name} We are currently closed. I can take a message or schedule a callback. How can I help?`
  }
  return `${disclosure}Thank you for calling.${name} How can I help you today — service, scheduling, or general questions?`
}

export class DeterministicReceptionistProvider implements VoiceAiReceptionistProvider {
  id = "deterministic" as const

  isConfigured(): boolean {
    return true
  }

  async generateResponse(context: ReceptionistProviderContext): Promise<ReceptionistProviderResponse> {
    const start = Date.now()
    let text = ""

    if (!context.callerText.trim()) {
      text = buildSilenceFallbackResponse()
    } else if (context.phase === "greeting" || context.phase === "intent_detection") {
      text = buildGreeting(context)
    } else if (context.faqAnswer) {
      text = context.faqAnswer
    } else if (context.qualificationPrompt) {
      text = context.qualificationPrompt
    } else if (context.intent === "appointment_request") {
      text = "I can help with scheduling. Let me gather a few details for our team."
    } else if (context.intent === "speak_to_human" || context.intent === "emergency") {
      text = "I'll connect you with a team member right away. One moment please."
    } else {
      text = "Let me make sure I understand. Could you tell me if this is about service, scheduling, or a general question?"
    }

    const sanitized = sanitizeReceptionistResponse(text)
    return {
      spokenText: sanitized.text,
      evidenceText: sanitized.violations.length
        ? `Guardrails: ${sanitized.violations.map((v) => v.code).join(", ")}`
        : `Deterministic response for phase ${context.phase}`,
      latencyMs: Date.now() - start,
      providerId: "deterministic",
    }
  }
}

export const deterministicReceptionistProvider = new DeterministicReceptionistProvider()
