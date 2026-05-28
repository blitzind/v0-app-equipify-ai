/** Structured call notes intelligence — Phase 3B (draft only). */

import type { VoiceStructuredCallNotes, VoiceStructuredFollowUpOutline } from "@/lib/voice/copilot-strategy/types"

export type StructuredNotesInput = {
  transcriptTexts: string[]
  objectionEvents: Array<{ title: string; evidenceText: string }>
  buyingSignalEvents: Array<{ title: string; evidenceText: string }>
  riskEvents: Array<{ title: string; evidenceText: string }>
  contactLabel?: string | null
  phase: string
}

function extractMatches(text: string, pattern: RegExp, limit = 3): string[] {
  const matches: string[] = []
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null && matches.length < limit) {
    matches.push(m[0].trim().slice(0, 120))
  }
  return matches
}

export function buildStructuredCallNotes(input: StructuredNotesInput): VoiceStructuredCallNotes {
  const combined = input.transcriptTexts.join(" ")

  const keyObjections = input.objectionEvents.map((e) => e.title || e.evidenceText.slice(0, 80)).slice(0, 4)
  const buyingSignals = input.buyingSignalEvents.map((e) => e.title || e.evidenceText.slice(0, 80)).slice(0, 4)
  const decisionMakers = extractMatches(
    combined,
    /\b(i'm the|i am the|decision maker|owner|director|vp)\s[\w\s]{0,40}/i,
    2,
  )
  const budgetConcerns = extractMatches(combined, /\b(budget|too expensive|cost|afford|pricing)\s[\w\s]{0,50}/i, 2)
  const timelineReferences = extractMatches(
    combined,
    /\b(this week|next quarter|asap|timeline|by \w+|deadline)\s[\w\s]{0,40}/i,
    2,
  )
  const commitmentsMade = extractMatches(
    combined,
    /\b(i'll|we'll|let me|i will|send you|follow up)\s[\w\s]{0,60}/i,
    2,
  )
  const unresolvedConcerns = input.riskEvents.map((e) => e.title || e.evidenceText.slice(0, 80)).slice(0, 3)
  const followUpPromises = extractMatches(combined, /\b(call back|email|send|follow up)\s[\w\s]{0,50}/i, 2)
  const escalationMoments = input.riskEvents
    .filter((e) => /escalat|angry|manager|supervisor/i.test(e.evidenceText))
    .map((e) => e.evidenceText.slice(0, 100))
    .slice(0, 2)

  const evidenceText = combined.slice(0, 200) || `Phase: ${input.phase}.`

  return {
    keyObjections,
    buyingSignals,
    decisionMakers,
    budgetConcerns,
    timelineReferences,
    commitmentsMade,
    unresolvedConcerns,
    followUpPromises,
    escalationMoments,
    evidenceText,
  }
}

export function buildStructuredFollowUpOutline(input: {
  notes: VoiceStructuredCallNotes
  phase: string
  retentionRecovery: boolean
  expansionSignal: boolean
}): VoiceStructuredFollowUpOutline {
  const { notes } = input
  const topConcern = notes.unresolvedConcerns[0] ?? notes.keyObjections[0] ?? "open items from the call"
  const topSignal = notes.buyingSignals[0] ?? "interest discussed on the call"

  return {
    callbackOutline: `Recap: ${topConcern}. Confirm next step and timeline.`,
    followUpAgenda: `1) Acknowledge ${topConcern}\n2) Review ${topSignal}\n3) Propose one concrete next step`,
    relationshipRecoveryOutline: input.retentionRecovery
      ? `Address renewal concern: ${topConcern}. Offer one fix before discussing expansion.`
      : null,
    renewalDiscussionOutline: input.retentionRecovery ? `Renewal topics: ${notes.timelineReferences.join("; ") || "timeline TBD"}.` : null,
    expansionOpportunityOutline: input.expansionSignal
      ? `Expansion angle: ${topSignal}. Explore team/scope fit — operator sends manually.`
      : null,
    evidenceText: notes.evidenceText,
  }
}
