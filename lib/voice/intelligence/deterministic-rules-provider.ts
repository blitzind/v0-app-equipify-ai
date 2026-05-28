/** Deterministic transcript intelligence rules — default passive provider. */

import {
  combineSegmentConfidence,
  extractEvidenceSubstring,
  filterEvidenceBackedInsights,
} from "@/lib/voice/intelligence/evidence"
import type {
  VoiceIntelligenceAnalysisResult,
  VoiceIntelligenceSegmentInput,
} from "@/lib/voice/intelligence/types"

type RuleMatch = {
  category: "conversation" | "objection" | "buying_signal" | "risk" | "guidance"
  eventType: string
  pattern: RegExp
  patternConfidence: number
  suggestedOperatorAction: string
  memoryDraft?: {
    draftKind: string
    draftLabel: string
    draftValue: string
  } | null
}

const RULES: RuleMatch[] = [
  {
    category: "objection",
    eventType: "pricing_objection",
    pattern: /\b(too expensive|price is too high|can't afford|cannot afford|over budget|cost too much|pricing is high)\b/i,
    patternConfidence: 0.88,
    suggestedOperatorAction: "Acknowledge pricing concern and clarify value before quoting.",
    memoryDraft: { draftKind: "objection", draftLabel: "Objection", draftValue: "Price too high" },
  },
  {
    category: "objection",
    eventType: "competitor_mention",
    pattern: /\b(we use|already use|using)\s+[A-Za-z0-9][\w\s.-]{1,40}\b|\b(competitor|alternative vendor)\b/i,
    patternConfidence: 0.82,
    suggestedOperatorAction: "Ask what they like about the current provider before differentiating.",
    memoryDraft: { draftKind: "competitor", draftLabel: "Competitor mentioned", draftValue: "Current provider referenced" },
  },
  {
    category: "objection",
    eventType: "timing_objection",
    pattern: /\b(not ready|not the right time|call back|next quarter|later this year|maybe next year)\b/i,
    patternConfidence: 0.8,
    suggestedOperatorAction: "Confirm timeline and offer a lighter next step instead of pushing close.",
    memoryDraft: { draftKind: "timeline", draftLabel: "Decision timeline", draftValue: "Not ready now" },
  },
  {
    category: "buying_signal",
    eventType: "ready_to_book",
    pattern: /\b(schedule|book a|set up a|calendar link|send me a meeting|demo this week)\b/i,
    patternConfidence: 0.9,
    suggestedOperatorAction: "Offer specific meeting times while the caller is engaged.",
  },
  {
    category: "buying_signal",
    eventType: "decision_maker_signal",
    pattern: /\b(i'm the|i am the)\s+(owner|director|vp|decision maker|person who decides)\b/i,
    patternConfidence: 0.86,
    suggestedOperatorAction: "Confirm authority and ask for success criteria before proposing next steps.",
    memoryDraft: { draftKind: "committee", draftLabel: "Decision maker", draftValue: "Caller claims decision authority" },
  },
  {
    category: "buying_signal",
    eventType: "urgency_signal",
    pattern: /\b(asap|urgent|this week|need this soon|time sensitive|running out of time)\b/i,
    patternConfidence: 0.84,
    suggestedOperatorAction: "Validate urgency and propose the fastest credible path to resolution.",
  },
  {
    category: "risk",
    eventType: "angry_caller",
    pattern: /\b(angry|furious|ridiculous|wasting my time|this is unacceptable|stop calling me about)\b/i,
    patternConfidence: 0.9,
    suggestedOperatorAction: "De-escalate, acknowledge frustration, and avoid continuing the pitch.",
  },
  {
    category: "risk",
    eventType: "cancellation_risk",
    pattern: /\b(cancel (my|our)|we're leaving|switching away|terminate (the )?service)\b/i,
    patternConfidence: 0.87,
    suggestedOperatorAction: "Pause selling motion and clarify retention or support needs.",
  },
  {
    category: "risk",
    eventType: "opt_out_intent",
    pattern: /\b(stop calling|do not call|don't call|remove me|take me off|opt out)\b/i,
    patternConfidence: 0.92,
    suggestedOperatorAction: "Stop outreach pitch, confirm request, and route to compliance review manually.",
  },
  {
    category: "risk",
    eventType: "compliance_sensitive_language",
    pattern: /\b(lawyer|attorney|sue|harassment|illegal|tcpa|fcc complaint)\b/i,
    patternConfidence: 0.93,
    suggestedOperatorAction: "Escalate to supervisor/compliance review before continuing.",
  },
]

function buildGuidanceInsights(
  transcriptText: string,
  segmentConfidence: number | null,
): VoiceIntelligenceAnalysisResult["insights"] {
  const guidance: VoiceIntelligenceAnalysisResult["insights"] = []
  const lower = transcriptText.toLowerCase()

  if (/\b(ready to book|schedule|book a)\b/i.test(lower)) {
    guidance.push({
      category: "guidance",
      eventType: "next_best_action_book_meeting",
      confidenceScore: combineSegmentConfidence(0.86, segmentConfidence),
      evidenceText: extractEvidenceSubstring(transcriptText, "schedule") ?? transcriptText.slice(0, 80),
      suggestedOperatorAction: "Suggested next best action: propose two concrete meeting times.",
    })
  } else if (/\b(too expensive|price|budget)\b/i.test(lower)) {
    guidance.push({
      category: "guidance",
      eventType: "next_best_action_handle_pricing",
      confidenceScore: combineSegmentConfidence(0.84, segmentConfidence),
      evidenceText: extractEvidenceSubstring(transcriptText, "price") ?? transcriptText.slice(0, 80),
      suggestedOperatorAction: "Suggested next best action: clarify ROI and confirm budget range.",
    })
  } else if (/\b(stop calling|do not call|remove me)\b/i.test(lower)) {
    guidance.push({
      category: "guidance",
      eventType: "next_best_action_compliance_review",
      confidenceScore: combineSegmentConfidence(0.9, segmentConfidence),
      evidenceText: extractEvidenceSubstring(transcriptText, "stop calling") ?? transcriptText.slice(0, 80),
      suggestedOperatorAction: "Suggested next best action: pause pitch and route to compliance review.",
    })
  }

  return guidance
}

export function analyzeTranscriptSegmentWithDeterministicRules(
  input: VoiceIntelligenceSegmentInput,
): VoiceIntelligenceAnalysisResult {
  const transcriptText = input.transcriptText.trim()
  if (!transcriptText) {
    return { provider: "deterministic_rules", insights: [] }
  }

  const insights: VoiceIntelligenceAnalysisResult["insights"] = []

  for (const rule of RULES) {
    const match = transcriptText.match(rule.pattern)
    if (!match?.[0]) continue
    const evidenceText = extractEvidenceSubstring(transcriptText, match[0]) ?? match[0]
    insights.push({
      category: rule.category,
      eventType: rule.eventType,
      confidenceScore: combineSegmentConfidence(rule.patternConfidence, input.confidenceScore),
      evidenceText,
      suggestedOperatorAction: rule.suggestedOperatorAction,
      memoryDraft: rule.memoryDraft ?? null,
    })
  }

  insights.push(...buildGuidanceInsights(transcriptText, input.confidenceScore))

  return {
    provider: "deterministic_rules",
    insights: filterEvidenceBackedInsights(transcriptText, insights),
  }
}
