/** GE-AIOS-14A — Service Specialist (stub). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import { AVA_SPECIALIST_STUB_MESSAGE, type AvaSpecialistDefinition } from "@/lib/growth/specialists/types"

export const SERVICE_SPECIALIST: AvaSpecialistDefinition = {
  id: "service",
  name: "Service Specialist",
  domain: "service",
  capabilities: ["work orders", "dispatch intelligence", "scheduling"],
  stub: true,
}

export function serviceSpecialistAcceptsWork(item: AvaWorkItem): boolean {
  return /work order|dispatch|scheduling|schedule|sla|field service|technician/i.test(item.title)
}

export function serviceSpecialistEstimateConfidence(item: AvaWorkItem): number {
  return serviceSpecialistAcceptsWork(item) ? 40 : 0
}

export function serviceSpecialistSummarizeContribution(_item: AvaWorkItem): string {
  return AVA_SPECIALIST_STUB_MESSAGE
}
