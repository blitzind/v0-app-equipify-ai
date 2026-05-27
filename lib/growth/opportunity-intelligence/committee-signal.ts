import { sanitizeEvidenceSnippet } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { DetectedOpportunitySignal } from "@/lib/growth/opportunity-intelligence/signal-detector"

export type DetectedCommitteeSignal = {
  contactLabel: string
  roleHint: string | null
  signalStrength: "low" | "medium" | "high" | "verified"
  evidenceSnippet: string
  source: string
}

export function detectBuyingCommitteeSignals(input: {
  subject?: string
  body?: string
  signals: DetectedOpportunitySignal[]
  source?: string
}): DetectedCommitteeSignal[] {
  const evidence = sanitizeEvidenceSnippet(`${input.subject ?? ""} ${input.body ?? ""}`)
  const detected: DetectedCommitteeSignal[] = []
  const source = input.source ?? "inbox_classifier"

  if (input.signals.some((signal) => signal.signalType === "committee_detected")) {
    detected.push({
      contactLabel: "Additional stakeholder",
      roleHint: "committee member",
      signalStrength: "medium",
      evidenceSnippet: evidence,
      source,
    })
  }

  if (input.signals.some((signal) => signal.signalType === "decision_maker_detected")) {
    const roleMatch = evidence.match(/\b(ceo|cto|cfo|vp|director|head of [a-z ]+)\b/i)
    detected.push({
      contactLabel: roleMatch?.[1] ? roleMatch[1].toUpperCase() : "Decision maker",
      roleHint: roleMatch?.[1]?.toLowerCase() ?? "decision maker",
      signalStrength: "high",
      evidenceSnippet: evidence,
      source,
    })
  }

  if (/\brefer\b|\bintroduce\b|\bcolleague\b|\bpass along\b/i.test(evidence)) {
    detected.push({
      contactLabel: "Referred contact",
      roleHint: "referral",
      signalStrength: "medium",
      evidenceSnippet: evidence,
      source,
    })
  }

  const unique = new Map<string, DetectedCommitteeSignal>()
  for (const signal of detected) {
    unique.set(`${signal.contactLabel}:${signal.roleHint ?? ""}`, signal)
  }
  return [...unique.values()]
}
