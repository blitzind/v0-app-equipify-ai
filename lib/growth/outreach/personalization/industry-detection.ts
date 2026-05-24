/** Deterministic industry detection for outreach personalization (slice 6.15B). */

import type { OutreachContextPacket, OutreachIndustryKey } from "@/lib/growth/outreach/personalization/personalization-types"

const HVAC_TERMS = /\b(hvac|heating|cooling|air conditioning|mechanical contractor|furnace|ac repair)\b/i
const MEDICAL_TERMS = /\b(medical equipment|biomed|healthcare equipment|hospital|clinical|dme|imaging service)\b/i
const FIELD_SERVICE_TERMS = /\b(field service|service contractor|maintenance contract|dispatch|technician fleet|service call)\b/i

function haystack(packet: OutreachContextPacket): string {
  return [
    packet.industryLabel,
    packet.companyName,
    ...packet.websiteFindings,
    ...packet.enrichmentFindings,
    ...packet.equipmentServiceIndicators,
    ...packet.researchPainPoints,
  ]
    .filter(Boolean)
    .join(" ")
}

export function detectOutreachIndustry(packet: OutreachContextPacket): OutreachIndustryKey {
  const text = haystack(packet)
  if (MEDICAL_TERMS.test(text)) return "medical_equipment"
  if (HVAC_TERMS.test(text)) return "hvac"
  if (FIELD_SERVICE_TERMS.test(text) || packet.equipmentServiceIndicators.length > 0) return "field_service"
  return "general"
}

export function outreachIndustryLabel(industry: OutreachIndustryKey): string {
  if (industry === "hvac") return "HVAC"
  if (industry === "medical_equipment") return "Medical Equipment"
  if (industry === "field_service") return "Field Service"
  return "Operations"
}
