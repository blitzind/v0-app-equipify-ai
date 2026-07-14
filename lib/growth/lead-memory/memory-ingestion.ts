import {
  isAutoReplyEvidence,
  isInternalMemoryPipelineTitle,
} from "@/lib/growth/lead-memory/outreach-memory-evidence-guard"
import {
  confidenceRank,
  sanitizeMemoryEvidenceSnippet,
  type GrowthLeadMemoryCategory,
  type GrowthMemoryConfidence,
} from "@/lib/growth/lead-memory/memory-types"

export type MemoryIngestionInput = {
  sourceSystem: string
  subject?: string
  body?: string
  signalType?: string
  classification?: string
  engagementTier?: string
  meetingIntent?: boolean
  budgetMention?: boolean
  timelineMention?: boolean
  competitorMention?: boolean
  committeeMention?: boolean
  unsubscribeDetected?: boolean
  complaintDetected?: boolean
}

export type IngestedMemoryCandidate = {
  memoryCategory: GrowthLeadMemoryCategory
  confidence: GrowthMemoryConfidence
  title: string
  evidenceSnippet: string
  sourceSystem: string
}

const OBJECTION_PATTERNS: Array<{ type: string; label: string; pattern: RegExp }> = [
  { type: "budget", label: "Budget objection", pattern: /\b(budget|cost|price|expensive|afford)\b/i },
  { type: "timing", label: "Timing objection", pattern: /\b(not now|next quarter|later|timing|busy)\b/i },
  { type: "authority", label: "Authority objection", pattern: /\b(not the decision|need approval|boss|committee)\b/i },
  { type: "competitor", label: "Competitor mention", pattern: /\b(already using|competitor|vendor|incumbent)\b/i },
  { type: "not_interested", label: "Not interested", pattern: /\b(not interested|no thanks|stop emailing|unsubscribe)\b/i },
]

function evidenceFromInput(input: MemoryIngestionInput): string {
  const combined = `${input.subject ?? ""} ${input.body ?? ""}`.trim()
  return sanitizeMemoryEvidenceSnippet(combined || input.signalType || "Activity detected")
}

export function ingestMemoryCandidatesFromSource(input: MemoryIngestionInput): IngestedMemoryCandidate[] {
  const candidates: IngestedMemoryCandidate[] = []
  const evidence = evidenceFromInput(input)
  if (evidence.length < 8) return candidates

  const rawCombined = `${input.subject ?? ""} ${input.body ?? ""}`.trim()
  if (isAutoReplyEvidence(rawCombined) || isAutoReplyEvidence(evidence)) {
    return candidates
  }

  if (input.meetingIntent) {
    candidates.push({
      memoryCategory: "meeting_signal",
      confidence: "high",
      title: "Meeting interest detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.budgetMention) {
    candidates.push({
      memoryCategory: "budget_signal",
      confidence: "medium",
      title: "Budget signal detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.timelineMention) {
    candidates.push({
      memoryCategory: "timeline_signal",
      confidence: "medium",
      title: "Timeline signal detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.competitorMention) {
    candidates.push({
      memoryCategory: "competitor_signal",
      confidence: "high",
      title: "Competitive context detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.committeeMention) {
    candidates.push({
      memoryCategory: "committee_member",
      confidence: "medium",
      title: "Committee involvement detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.signalType === "positive_interest" || input.classification === "positive_interest") {
    candidates.push({
      memoryCategory: "buying_signal",
      confidence: "high",
      title: "Buying signal detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.engagementTier === "hot" || input.engagementTier === "engaged") {
    candidates.push({
      memoryCategory: "engagement_pattern",
      confidence: input.engagementTier === "hot" ? "high" : "medium",
      title: "Engagement pattern recorded",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (input.unsubscribeDetected || input.complaintDetected) {
    candidates.push({
      memoryCategory: "risk_signal",
      confidence: "verified",
      title: input.unsubscribeDetected ? "Unsubscribe risk" : "Complaint risk",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  const text = `${input.subject ?? ""} ${input.body ?? ""}`
  for (const objection of OBJECTION_PATTERNS) {
    if (objection.pattern.test(text)) {
      candidates.push({
        memoryCategory: "objection",
        confidence: "medium",
        title: objection.label,
        evidenceSnippet: evidence,
        sourceSystem: input.sourceSystem,
      })
    }
  }

  if (/\b(call me after|prefers|communication style|afternoon calls)\b/i.test(text)) {
    candidates.push({
      memoryCategory: "communication_preference",
      confidence: "medium",
      title: /call me after/i.test(text) ? "Prefers afternoon calls" : "Communication style preference",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (/\b(send|checklist|due|friday|follow-up|commitment)\b/i.test(text)) {
    candidates.push({
      memoryCategory: "meeting_signal",
      confidence: "medium",
      title: /checklist/i.test(text) ? "Action commitment: checklist requested" : "Action commitment detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (/\b(opening|expansion|location|software|servicetitan|incumbent)\b/i.test(text)) {
    candidates.push({
      memoryCategory: "industry_interest",
      confidence: "medium",
      title: /expansion|location/i.test(text)
        ? "Expansion initiative noted"
        : /software|servicetitan/i.test(text)
          ? "Current software context noted"
          : "Business fact detected",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  if (/\b(email|call|text|linkedin|morning|afternoon)\b/i.test(text)) {
    candidates.push({
      memoryCategory: "communication_preference",
      confidence: "low",
      title: "Communication preference hint",
      evidenceSnippet: evidence,
      sourceSystem: input.sourceSystem,
    })
  }

  return dedupeCandidates(candidates)
}

function dedupeCandidates(candidates: IngestedMemoryCandidate[]): IngestedMemoryCandidate[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.memoryCategory}:${candidate.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasMinimumMemoryEvidence(snippet: string): boolean {
  return sanitizeMemoryEvidenceSnippet(snippet).length >= 8
}

export function mergeConfidence(a: GrowthMemoryConfidence, b: GrowthMemoryConfidence): GrowthMemoryConfidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b
}
