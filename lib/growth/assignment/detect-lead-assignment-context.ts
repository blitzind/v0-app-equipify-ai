import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthLeadAssignmentIndustry } from "@/lib/growth/assignment/assignment-types"

const HVAC_TERMS = /\b(hvac|heating|cooling|air conditioning|mechanical contractor|furnace|ac repair)\b/i
const MEDICAL_TERMS = /\b(medical equipment|biomed|healthcare equipment|hospital|clinical|dme|imaging service)\b/i
const FIELD_SERVICE_TERMS = /\b(field service|service contractor|maintenance contract|dispatch|technician fleet|service call)\b/i

export function detectGrowthLeadAssignmentIndustry(lead: Pick<
  GrowthLead,
  "companyName" | "crmDetected" | "fieldServiceStackDetected" | "metadata"
>): GrowthLeadAssignmentIndustry {
  const text = [
    lead.companyName,
    lead.crmDetected,
    lead.fieldServiceStackDetected,
    typeof lead.metadata?.industry === "string" ? lead.metadata.industry : null,
  ]
    .filter(Boolean)
    .join(" ")

  if (MEDICAL_TERMS.test(text)) return "medical_equipment"
  if (HVAC_TERMS.test(text)) return "hvac"
  if (FIELD_SERVICE_TERMS.test(text)) return "field_service"
  return "general"
}

export function normalizeTerritoryToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.toUpperCase() : null
}

export function leadTerritoryTokens(lead: Pick<GrowthLead, "state" | "city" | "country">): string[] {
  return [lead.state, lead.city, lead.country].map(normalizeTerritoryToken).filter(Boolean) as string[]
}

export function isHighPriorityLeadForAssignment(lead: Pick<
  GrowthLead,
  "score" | "callPriorityTier" | "executivePriorityTier" | "engagementTier"
>): boolean {
  if (lead.executivePriorityTier === "executive_now" || lead.executivePriorityTier === "priority") return true
  if (lead.callPriorityTier === "critical" || lead.callPriorityTier === "high") return true
  if (lead.engagementTier === "hot") return true
  return (lead.score ?? 0) >= 75
}
