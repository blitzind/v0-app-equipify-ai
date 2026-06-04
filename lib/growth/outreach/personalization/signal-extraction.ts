/** Deterministic personalization signal extraction (Growth Engine slice 6.15B). */

import type {
  OutreachContextPacket,
  PersonalizationSignalKey,
} from "@/lib/growth/outreach/personalization/personalization-types"

const SCHEDULER_GAP = /\b(no online scheduling|no scheduler|call to schedule|phone.?only booking|request service form only)\b/i
const DISPATCH_MANUAL = /\b(manual dispatch|spreadsheet dispatch|whiteboard|paper route|phone.?based scheduling|dispatch board)\b/i
const TECH_HIRING = /\b(hiring.{0,24}technicians?|technician openings|service tech jobs|installer openings|field tech hiring)\b/i
const MANUAL_PROCESS = /\b(manual process|spreadsheet|paperwork|double entry|copy.?paste|legacy workflow)\b/i

function includesAny(values: string[], pattern: RegExp): boolean {
  return values.some((value) => pattern.test(value))
}

export function extractPersonalizationSignals(packet: OutreachContextPacket): PersonalizationSignalKey[] {
  const signals: PersonalizationSignalKey[] = []
  const combinedFindings = [
    ...(packet.websiteSummary ? [packet.websiteSummary] : []),
    ...packet.websiteFindings,
    ...packet.enrichmentFindings,
    ...packet.researchPainPoints,
    ...packet.equipmentServiceIndicators,
    ...(packet.leadEngineGuidance?.prioritizedPainPoints ?? []),
  ]

  if (!packet.hasWebsiteResearch || includesAny(combinedFindings, SCHEDULER_GAP)) {
    if (includesAny(combinedFindings, SCHEDULER_GAP) || (packet.website && !packet.hasWebsiteResearch)) {
      signals.push("website_has_no_scheduler")
    }
  }

  if (includesAny(combinedFindings, DISPATCH_MANUAL)) {
    signals.push("dispatch_appears_manual")
  }

  if (
    packet.equipmentServiceIndicators.length > 0 ||
    packet.industryLabel?.toLowerCase().includes("field") ||
    includesAny(combinedFindings, /\b(field operations|service fleet|work orders|route optimization)\b/i)
  ) {
    signals.push("field_operations_signal")
  }

  if (includesAny([...packet.hiringSignals, ...combinedFindings], TECH_HIRING)) {
    signals.push("technician_hiring_signal")
  }

  if (includesAny(combinedFindings, MANUAL_PROCESS)) {
    signals.push("manual_process_signal")
  }

  if (
    packet.capacitySignals.some((signal) => /growth|expansion|backlog|strained|capacity/i.test(signal)) ||
    (packet.engagementScore ?? 0) >= 60
  ) {
    signals.push("capacity_growth_signal")
  }

  if (
    packet.priorReplySummaries.length === 0 &&
    packet.priorTouchCount >= 2 &&
    packet.priorTouchSummaries.some((entry) => /follow.?up|prior outreach|no reply/i.test(entry))
  ) {
    signals.push("slow_response_signal")
  }

  if ((packet.engagementScore ?? 0) >= 45 || packet.priorReplySummaries.length > 0) {
    signals.push("recent_engagement_signal")
  }

  if (packet.priorTouchCount >= 2) {
    signals.push("repeat_touch_signal")
  }

  if ((packet.fitScore ?? 0) >= 70) {
    signals.push("high_fit_signal")
  }

  if (packet.memoryAvailable) {
    if (
      packet.memoryInteractionSummaries.length > 0 ||
      packet.memoryCommitmentSummaries.length > 0 ||
      packet.priorReplySummaries.length > 0
    ) {
      signals.push("recent_engagement_signal")
    }
    if (packet.priorTouchCount >= 2 || packet.memoryInteractionSummaries.length >= 2) {
      signals.push("repeat_touch_signal")
    }
  }

  return [...new Set(signals)]
}
