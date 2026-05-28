/** Deterministic template AI copilot provider — default Phase 3A. */

import type { VoiceAiCopilotGenerationDraft } from "@/lib/voice/ai-copilot/types"
import type { VoiceAiCopilotGenerationContext, VoiceAiCopilotProvider, VoiceAiCopilotProviderResult } from "@/lib/voice/ai-copilot/provider-types"
import { generateDeepCopilotDrafts } from "@/lib/voice/copilot-strategy/deep-copilot-drafts"
import { buildCopilotStrategySnapshot } from "@/lib/voice/copilot-strategy/strategy-engine"

function draftFromEvent(
  event: VoiceAiCopilotGenerationContext["operatorAssistEvents"][number],
  suggestionType: VoiceAiCopilotGenerationDraft["suggestionType"],
  priority: number,
  title: string,
  body: string,
): VoiceAiCopilotGenerationDraft {
  return {
    suggestionType,
    priority,
    title,
    body,
    evidenceText: event.evidenceText,
    sourceEventIds: [event.id],
  }
}

export function generateDeterministicCopilotDrafts(context: VoiceAiCopilotGenerationContext): VoiceAiCopilotGenerationDraft[] {
  const drafts: VoiceAiCopilotGenerationDraft[] = []

  for (const event of context.operatorAssistEvents) {
    if (event.category === "objection") {
      drafts.push(
        draftFromEvent(
          event,
          "objection_response",
          85,
          "Address objection with evidence",
          `Acknowledge the concern, then respond: "${event.recommendation || event.title}". Stay operator-controlled — review before speaking.`,
        ),
      )
    } else if (event.category === "buying_signal") {
      drafts.push(
        draftFromEvent(
          event,
          "booking_prompt",
          80,
          "Booking suggestion draft",
          `The caller showed interest. Consider offering times: "${event.recommendation || "Would morning or afternoon work better for a follow-up?"}". Operator must confirm and book manually.`,
        ),
      )
      drafts.push(
        draftFromEvent(
          event,
          "discovery_question",
          72,
          "Discovery follow-up",
          `Ask a clarifying question tied to the signal: "What would success look like if we solved ${event.title.toLowerCase()}?"`,
        ),
      )
    } else if (event.category === "risk") {
      drafts.push(
        draftFromEvent(
          event,
          "escalation_recommendation",
          90,
          "Escalation recommendation draft",
          `Risk detected: ${event.title}. Consider supervisor visibility or a warm handoff. Operator decides whether to escalate — AI does not transfer automatically.`,
        ),
      )
    }
  }

  for (const signal of context.retentionSignals) {
    drafts.push({
      suggestionType: "retention_response",
      priority: 78,
      title: "Retention response draft",
      body: `Reference the concern and offer a concrete next step: "${signal.recommendation || "Let's review what's blocking renewal and agree on one fix before we hang up."}" Operator reviews before responding.`,
      evidenceText: signal.evidenceText,
      sourceEventIds: [signal.id],
    })
  }

  for (const signal of context.revenueSignals) {
    drafts.push({
      suggestionType: "expansion_response",
      priority: 74,
      title: "Expansion response draft",
      body: `Expansion signal noted. Explore fit: "${signal.recommendation || "Which teams would benefit most from expanding coverage?"}" Operator-controlled — no automatic CRM updates.`,
      evidenceText: signal.evidenceText,
      sourceEventIds: [signal.id],
    })
  }

  const transcriptEvidence = context.transcriptWindow
    .slice(-3)
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" · ")

  if (transcriptEvidence.length >= 20) {
    drafts.push({
      suggestionType: "live_summary_draft",
      priority: 60,
      title: "Live summary draft",
      body: `So far: ${context.contactLabel ? `Speaking with ${context.contactLabel}. ` : ""}${transcriptEvidence.slice(0, 240)}… Review and edit before saving anywhere.`,
      evidenceText: transcriptEvidence.slice(0, 200),
      sourceEventIds: context.transcriptWindow.slice(-3).map((segment) => segment.id),
    })

    drafts.push({
      suggestionType: "call_note_draft",
      priority: 58,
      title: "Call note draft",
      body: `Call note (draft only): ${transcriptEvidence.slice(0, 180)}. Operator must copy/review — not saved to CRM automatically.`,
      evidenceText: transcriptEvidence.slice(0, 200),
      sourceEventIds: context.transcriptWindow.slice(-2).map((segment) => segment.id),
    })

    drafts.push({
      suggestionType: "follow_up_draft",
      priority: 55,
      title: "Follow-up draft",
      body: `Follow-up idea: Recap today's discussion and propose one next step based on "${transcriptEvidence.slice(0, 80)}". Operator sends manually after review.`,
      evidenceText: transcriptEvidence.slice(0, 200),
      sourceEventIds: context.transcriptWindow.slice(-2).map((segment) => segment.id),
    })
  }

  const nba = context.operatorAssistEvents.find((event) => event.source === "operator_assist_nba")
  if (nba) {
    drafts.push({
      suggestionType: "next_best_response",
      priority: 88,
      title: "Next best response",
      body: nba.recommendation || nba.title,
      evidenceText: nba.evidenceText,
      sourceEventIds: [nba.id],
    })
  } else if (context.operatorAssistEvents[0]) {
    const top = context.operatorAssistEvents[0]
    drafts.push({
      suggestionType: "next_best_response",
      priority: 82,
      title: "Next best response",
      body: top.recommendation || top.title,
      evidenceText: top.evidenceText,
      sourceEventIds: [top.id],
    })
  }

  drafts.push({
    suggestionType: "compliance_reminder",
    priority: 40,
    title: "Compliance reminder",
    body: "Confirm recording/consent disclosures if required. AI suggestions are operator-reviewed only — do not promise pricing or compliance outcomes not supported by evidence.",
    evidenceText: "Operator-controlled live call — passive AI copilot mode.",
    sourceEventIds: [],
  })

  const strategy = context.strategy ?? buildCopilotStrategySnapshot({
    operatorAssist: context.operatorAssistSnapshot ?? null,
    liveTranscript: context.liveTranscriptSnapshot ?? null,
    retentionIntelligence: context.retentionIntelligenceSnapshot ?? null,
  })
  drafts.push(...generateDeepCopilotDrafts(context, strategy))

  return drafts
}

export const deterministicTemplateCopilotProvider: VoiceAiCopilotProvider = {
  id: "deterministic_template",
  async generateSuggestions(context: VoiceAiCopilotGenerationContext): Promise<VoiceAiCopilotProviderResult> {
    return {
      provider: "deterministic_template",
      drafts: generateDeterministicCopilotDrafts(context),
    }
  },
}
