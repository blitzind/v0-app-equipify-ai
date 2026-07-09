/** GE-AIOS-14A — Finance Specialist (stub). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import { AVA_SPECIALIST_STUB_MESSAGE, type AvaSpecialistDefinition } from "@/lib/growth/specialists/types"

export const FINANCE_SPECIALIST: AvaSpecialistDefinition = {
  id: "finance",
  name: "Finance Specialist",
  domain: "finance",
  capabilities: ["invoices", "collections", "payment follow-up", "forecasting"],
  stub: true,
}

export function financeSpecialistAcceptsWork(item: AvaWorkItem): boolean {
  return /invoice|collection|payment|forecast|billing|reconcile|accounts receivable/i.test(item.title)
}

export function financeSpecialistEstimateConfidence(item: AvaWorkItem): number {
  return financeSpecialistAcceptsWork(item) ? 44 : 0
}

export function financeSpecialistSummarizeContribution(_item: AvaWorkItem): string {
  return AVA_SPECIALIST_STUB_MESSAGE
}
