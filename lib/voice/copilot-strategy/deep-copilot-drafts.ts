/** Deep copilot suggestion drafts — Phase 3B (deterministic, strategy-aware). */

import type { VoiceAiCopilotGenerationDraft } from "@/lib/voice/ai-copilot/types"
import type { VoiceCopilotStrategySnapshot } from "@/lib/voice/copilot-strategy/types"
import type { VoiceAiCopilotGenerationContext } from "@/lib/voice/ai-copilot/provider-types"

function whyPrefix(reason: string, body: string): string {
  return `${body}\n\nWhy this suggestion: ${reason}`
}

export function generateDeepCopilotDrafts(
  context: VoiceAiCopilotGenerationContext,
  strategy: VoiceCopilotStrategySnapshot,
): VoiceAiCopilotGenerationDraft[] {
  const drafts: VoiceAiCopilotGenerationDraft[] = []
  const phase = strategy.conversationPhase.phase
  const evidence = strategy.conversationPhase.evidenceText

  if (strategy.objectionStage.stage === "unresolved" || strategy.objectionStage.stage === "surfaced") {
    const obj = context.operatorAssistEvents.find((e) => e.category === "objection")
    drafts.push({
      suggestionType: "objection_strategy",
      priority: 86,
      title: "Objection handling strategy",
      body: whyPrefix(
        `Objection stage: ${strategy.objectionStage.stage}.`,
        obj
          ? `Validate concern, isolate the blocker, then respond with evidence: "${obj.recommendation || obj.title}". Operator speaks — AI does not respond.`
          : "Validate concern before countering. Ask what would need to be true to move forward.",
      ),
      evidenceText: obj?.evidenceText ?? strategy.objectionStage.evidenceText,
      sourceEventIds: obj ? [obj.id] : [],
    })
  }

  if (strategy.rapportStrength.direction === "weakening") {
    drafts.push({
      suggestionType: "rapport_repair",
      priority: 84,
      title: "Rapport repair prompt",
      body: whyPrefix(
        `Rapport score ${strategy.rapportStrength.score}/100, direction weakening.`,
        "Acknowledge frustration, summarize their concern, and ask permission to continue. Stay calm — operator-controlled.",
      ),
      evidenceText: strategy.rapportStrength.evidenceText,
      sourceEventIds: [],
    })
  }

  if (strategy.escalationLikelihood.level === "elevated" || strategy.escalationLikelihood.level === "critical") {
    drafts.push({
      suggestionType: "de_escalation_prompt",
      priority: 92,
      title: "De-escalation guidance",
      body: whyPrefix(
        `Escalation risk: ${strategy.escalationLikelihood.level}.`,
        "Pause the pitch. Confirm you heard their concern, avoid debating, and offer a concrete next step. Operator decides escalation — no auto-transfer.",
      ),
      evidenceText: strategy.escalationLikelihood.evidenceText,
      sourceEventIds: [],
    })
  }

  if (phase === "pricing_discussion" || /\b(price|pricing|cost)\b/i.test(evidence)) {
    drafts.push({
      suggestionType: "pricing_positioning",
      priority: 80,
      title: "Pricing positioning draft",
      body: whyPrefix(
        "Pricing discussion detected in transcript.",
        "Anchor on value and scope before quoting. Do not promise discounts not in evidence. Operator confirms final pricing.",
      ),
      evidenceText: evidence,
      sourceEventIds: [],
    })
  }

  if (strategy.discoveryCompleteness.gaps.length > 0 && strategy.discoveryCompleteness.score < 55) {
    drafts.push({
      suggestionType: "qualification_gap",
      priority: 76,
      title: "Qualification gap",
      body: whyPrefix(
        `Discovery ${strategy.discoveryCompleteness.score}% complete.`,
        `Ask about: ${strategy.discoveryCompleteness.gaps.slice(0, 2).join(" and ")}.`,
      ),
      evidenceText: strategy.discoveryCompleteness.evidenceText,
      sourceEventIds: [],
    })
  }

  if (strategy.closeReadiness.ready) {
    drafts.push({
      suggestionType: "close_timing_suggestion",
      priority: 78,
      title: "Close timing suggestion",
      body: whyPrefix(
        `Close readiness score ${strategy.closeReadiness.score}/100.`,
        "Summarize agreed value and propose a specific next step. Operator confirms — no auto-booking.",
      ),
      evidenceText: strategy.closeReadiness.evidenceText,
      sourceEventIds: [],
    })
  }

  if (phase === "retention_recovery" || context.retentionSignals.length > 0) {
    const signal = context.retentionSignals[0]
    drafts.push({
      suggestionType: "retention_recovery_prompt",
      priority: 82,
      title: "Retention recovery outline",
      body: whyPrefix(
        "Retention/recovery phase or signal active.",
        strategy.structuredFollowUp.relationshipRecoveryOutline ??
          "Confirm the blocker, agree on one fix, and schedule a follow-up. Operator-controlled.",
      ),
      evidenceText: signal?.evidenceText ?? strategy.structuredNotes.evidenceText,
      sourceEventIds: signal ? [signal.id] : [],
    })
  }

  if (context.revenueSignals.some((s) => s.category === "expansion") || context.retentionSignals.some((s) => s.category === "expansion")) {
    const signal = context.revenueSignals[0] ?? context.retentionSignals[0]
    drafts.push({
      suggestionType: "expansion_conversation_prompt",
      priority: 74,
      title: "Expansion conversation prompt",
      body: whyPrefix(
        "Expansion signal in intelligence feed.",
        strategy.structuredFollowUp.expansionOpportunityOutline ??
          "Explore which teams would benefit — operator updates CRM manually after the call.",
      ),
      evidenceText: signal?.evidenceText ?? evidence,
      sourceEventIds: signal ? [signal.id] : [],
    })
  }

  if (strategy.pacing.pacingLabel === "operator_heavy" || strategy.pacing.operatorTalkPercent >= 68) {
    drafts.push({
      suggestionType: "operator_pacing_alert",
      priority: 70,
      title: "Pacing alert",
      body: whyPrefix(
        strategy.pacing.evidenceText,
        "You're carrying most of the talk time. Ask an open question and pause for the customer to respond.",
      ),
      evidenceText: strategy.pacing.evidenceText,
      sourceEventIds: [],
    })
  }

  if (strategy.callQualityInsights.some((i) => i.kind === "excessive_interruption")) {
    drafts.push({
      suggestionType: "operator_interrupt_alert",
      priority: 72,
      title: "Interruption coaching",
      body: whyPrefix(
        "Interruption pattern detected — assistive coaching only.",
        "Let the customer finish their thought before responding. Non-punitive coaching signal.",
      ),
      evidenceText:
        strategy.callQualityInsights.find((i) => i.kind === "excessive_interruption")?.evidenceText ??
        strategy.pacing.evidenceText,
      sourceEventIds: [],
    })
  }

  if (strategy.escalationLikelihood.level !== "low") {
    drafts.push({
      suggestionType: "compliance_recovery_prompt",
      priority: 68,
      title: "Compliance recovery reminder",
      body: whyPrefix(
        "Elevated tension — compliance-safe language required.",
        "Avoid promises, confirm consent/recording if needed, and do not bypass opt-out. Operator-reviewed only.",
      ),
      evidenceText: strategy.escalationLikelihood.evidenceText,
      sourceEventIds: [],
    })
  }

  // Structured note draft enhancement
  const notes = strategy.structuredNotes
  if (notes.keyObjections.length > 0 || notes.buyingSignals.length > 0) {
    const sections = [
      notes.keyObjections.length ? `Objections: ${notes.keyObjections.join("; ")}` : null,
      notes.buyingSignals.length ? `Buying signals: ${notes.buyingSignals.join("; ")}` : null,
      notes.timelineReferences.length ? `Timeline: ${notes.timelineReferences.join("; ")}` : null,
      notes.unresolvedConcerns.length ? `Open: ${notes.unresolvedConcerns.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    drafts.push({
      suggestionType: "call_note_draft",
      priority: 62,
      title: "Structured call note draft",
      body: `${sections}\n\nDraft only — operator copy/review. Not saved to CRM automatically.`,
      evidenceText: notes.evidenceText,
      sourceEventIds: [],
    })

    drafts.push({
      suggestionType: "follow_up_draft",
      priority: 58,
      title: "Structured follow-up draft",
      body: `${strategy.structuredFollowUp.followUpAgenda}\n\n${strategy.structuredFollowUp.callbackOutline}\n\nOperator sends manually after review.`,
      evidenceText: strategy.structuredFollowUp.evidenceText,
      sourceEventIds: [],
    })
  }

  return drafts
}
