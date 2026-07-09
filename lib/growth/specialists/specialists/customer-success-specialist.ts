/** GE-AIOS-14A — Customer Success Specialist (stub). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import { AVA_SPECIALIST_STUB_MESSAGE, type AvaSpecialistDefinition } from "@/lib/growth/specialists/types"

export const CUSTOMER_SUCCESS_SPECIALIST: AvaSpecialistDefinition = {
  id: "customer_success",
  name: "Customer Success Specialist",
  domain: "customer_success",
  capabilities: ["renewals", "customer health", "expansion opportunities", "adoption"],
  stub: true,
}

export function customerSuccessSpecialistAcceptsWork(item: AvaWorkItem): boolean {
  return /renewal|customer health|expansion|adoption|retention|account health/i.test(item.title)
}

export function customerSuccessSpecialistEstimateConfidence(item: AvaWorkItem): number {
  return customerSuccessSpecialistAcceptsWork(item) ? 42 : 0
}

export function customerSuccessSpecialistSummarizeContribution(_item: AvaWorkItem): string {
  return AVA_SPECIALIST_STUB_MESSAGE
}
