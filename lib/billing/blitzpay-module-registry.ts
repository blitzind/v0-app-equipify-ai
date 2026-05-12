/**
 * BlitzPay commercial module identifiers — stable keys for catalog + entitlement mapping.
 */
export type BlitzpayCommercialModuleKey =
  | "payments_connect"
  | "customer_invoicing"
  | "treasury_payouts"
  | "collections"
  | "memberships_recurring"
  | "payroll_accruals"
  | "cash_planning"
  | "general_ledger"
  | "vendor_ap"
  | "tax_compliance"
  | "financing_marketplace"
  | "procurement_inventory"
  | "ai_copilot"
  | "revenue_optimization"
  | "multi_entity_franchise"
  | "supplier_network"
  | "claims_protection"
  | "mobile_financial_ops"
  | "enterprise_observability"
  | "financial_command_center"
  | "insights_hub"
  /** Platform admin consoles — explicit classification, not a tenant SaaS tier gate. */
  | "platform_blitzpay_operations"

export const BLITZPAY_COMMERCIAL_MODULE_KEYS: readonly BlitzpayCommercialModuleKey[] = [
  "payments_connect",
  "customer_invoicing",
  "treasury_payouts",
  "collections",
  "memberships_recurring",
  "payroll_accruals",
  "cash_planning",
  "general_ledger",
  "vendor_ap",
  "tax_compliance",
  "financing_marketplace",
  "procurement_inventory",
  "ai_copilot",
  "revenue_optimization",
  "multi_entity_franchise",
  "supplier_network",
  "claims_protection",
  "mobile_financial_ops",
  "enterprise_observability",
  "financial_command_center",
  "insights_hub",
  "platform_blitzpay_operations",
] as const
