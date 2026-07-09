/** GE-AIOS-14A — Marketing Specialist (stub). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import { AVA_SPECIALIST_STUB_MESSAGE, type AvaSpecialistDefinition } from "@/lib/growth/specialists/types"

export const MARKETING_SPECIALIST: AvaSpecialistDefinition = {
  id: "marketing",
  name: "Marketing Specialist",
  domain: "marketing",
  capabilities: ["campaigns", "social planning", "ad recommendations", "content ideas", "audience strategy"],
  stub: true,
}

export function marketingSpecialistAcceptsWork(item: AvaWorkItem): boolean {
  return /campaign|social|content|audience|marketing|ad recommendation/i.test(item.title)
}

export function marketingSpecialistEstimateConfidence(item: AvaWorkItem): number {
  return marketingSpecialistAcceptsWork(item) ? 45 : 0
}

export function marketingSpecialistSummarizeContribution(_item: AvaWorkItem): string {
  return AVA_SPECIALIST_STUB_MESSAGE
}
