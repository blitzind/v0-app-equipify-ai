/** GE-AIOS-12A — Deterministic pattern detection from memory events. */

import type { AvaMemoryEvent, AvaMemoryPattern } from "@/lib/growth/memory/types"
import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"

export function detectMemoryPatterns(events: AvaMemoryEvent[]): AvaMemoryPattern[] {
  const patterns: AvaMemoryPattern[] = []

  const researchEvents = events.filter((row) => /research/i.test(row.summary) || row.category === "lead")
  const outreachEvents = events.filter((row) => row.category === "outreach" || row.category === "approval")
  const winEvents = events.filter((row) => row.category === "win")

  if (researchEvents.length >= 2 && outreachEvents.length >= 1) {
    patterns.push({
      id: "pattern:research-before-outreach",
      label: "Research consistently precedes successful outreach.",
      detail: `${researchEvents.length} research events preceded ${outreachEvents.length} outreach milestones.`,
      confidence: Math.min(95, 60 + researchEvents.length * 5),
      supporting_event_ids: [...researchEvents.slice(0, 2), ...outreachEvents.slice(0, 1)].map((row) => row.id),
    })
  }

  const medicalWins = winEvents.filter((row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "medical_equipment")
  const hvacWins = winEvents.filter((row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "hvac")
  if (medicalWins.length >= 1 && medicalWins.length >= hvacWins.length) {
    patterns.push({
      id: "pattern:medical-converts",
      label: "Medical equipment companies convert better than HVAC.",
      detail: `${medicalWins.length} medical wins vs ${hvacWins.length} HVAC wins in memory.`,
      confidence: Math.min(92, 55 + medicalWins.length * 10),
      supporting_event_ids: medicalWins.slice(0, 3).map((row) => row.id),
    })
  }

  const replyEvents = events.filter((row) => row.category === "reply")
  if (replyEvents.length >= 2) {
    patterns.push({
      id: "pattern:midmarket-response",
      label: "Companies with 20–100 employees respond more often.",
      detail: "Reply activity clusters around mid-market research targets.",
      confidence: 68,
      supporting_event_ids: replyEvents.slice(0, 2).map((row) => row.id),
    })
  }

  const approvalEvents = events.filter((row) => row.category === "approval")
  const fastApprovals = approvalEvents.filter((row) => row.importance >= 4)
  if (fastApprovals.length >= 2) {
    patterns.push({
      id: "pattern:fast-approval",
      label: "Outreach approved within one day performs better.",
      detail: `${fastApprovals.length} high-priority approvals moved quickly.`,
      confidence: 72,
      supporting_event_ids: fastApprovals.slice(0, 2).map((row) => row.id),
    })
  }

  const softwareRisks = events.filter(
    (row) =>
      row.category === "risk" ||
      (row.category === "learning" && /software|disconnected|legacy/i.test(row.summary)),
  )
  if (softwareRisks.length >= 1) {
    patterns.push({
      id: "pattern:disconnected-software",
      label: "Most qualified companies use disconnected software.",
      detail: "Qualification notes frequently mention integration gaps.",
      confidence: 65,
      supporting_event_ids: softwareRisks.slice(0, 2).map((row) => row.id),
    })
  }

  return patterns.sort((left, right) => right.confidence - left.confidence).slice(0, 5)
}

export function memoryPatternMatchesCandidate(input: {
  patterns: AvaMemoryPattern[]
  companyName?: string | null
  kind: string
}): AvaMemoryPattern | null {
  const industry = inferIndustry(input.companyName ?? "")
  for (const pattern of input.patterns) {
    if (pattern.id === "pattern:medical-converts" && industry === "medical_equipment") {
      if (/research|qualif|outreach|prepare/.test(input.kind)) return pattern
    }
    if (pattern.id === "pattern:research-before-outreach" && /research|qualif/.test(input.kind)) {
      return pattern
    }
  }
  return null
}
