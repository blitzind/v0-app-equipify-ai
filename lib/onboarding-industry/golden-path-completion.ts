import type { GoldenPathCompletionRule } from "@/lib/onboarding-industry/golden-path-types"

export type GoldenPathCompletionMetrics = {
  customersNonSample: number
  equipmentNonSample: number
  workOrdersNonSample: number
  quotesNonSample: number
  invoicesSentNonSample: number
  maintenancePlansNonSample: number
}

export function evaluateGoldenPathRule(rule: GoldenPathCompletionRule, m: GoldenPathCompletionMetrics): boolean {
  switch (rule.kind) {
    case "customers_non_sample_gte":
      return m.customersNonSample >= rule.n
    case "equipment_non_sample_gte":
      return m.equipmentNonSample >= rule.n
    case "work_orders_non_sample_gte":
      return m.workOrdersNonSample >= rule.n
    case "quotes_non_sample_gte":
      return m.quotesNonSample >= rule.n
    case "invoices_sent_non_sample_gte":
      return m.invoicesSentNonSample >= rule.n
    case "maintenance_plans_non_sample_gte":
      return m.maintenancePlansNonSample >= rule.n
    default:
      return false
  }
}
