import type { LucideIcon } from "lucide-react"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
import {
  Activity,
  BarChart3,
  Bot,
  BookOpen,
  Building2,
  FileStack,
  Landmark,
  LayoutDashboard,
  Network,
  PackageSearch,
  PiggyBank,
  Radio,
  Receipt,
  Repeat,
  Scale,
  Shield,
  Smartphone,
  TrendingUp,
  Truck,
  UserCircle,
  Users,
} from "lucide-react"

export type BlitzpayFccNavItem = {
  slug: string
  label: string
  icon: LucideIcon
}

const FCC_BASE = "/insights/financial-command-center"

export const BLITZPAY_FCC_NAV_ITEMS: BlitzpayFccNavItem[] = [
  { slug: "overview", label: "Overview / Command Center", icon: LayoutDashboard },
  { slug: "executive-health", label: "Executive Health", icon: Activity },
  { slug: "ai-financial-copilot", label: "AI Financial Copilot", icon: Bot },
  { slug: "revenue-optimization", label: "Revenue Optimization", icon: TrendingUp },
  { slug: "recurring-revenue", label: "Recurring Revenue & Renewals", icon: Repeat },
  { slug: "collections", label: "Collections", icon: FileStack },
  { slug: "billing-profiles", label: "Customer Billing Profiles", icon: UserCircle },
  { slug: "command-center-data", label: "Command Center Data", icon: BarChart3 },
  { slug: "multi-entity-finance", label: "Multi-Entity Finance", icon: Building2 },
  { slug: "supplier-network", label: "Supplier Network", icon: Network },
  { slug: "claims-protection", label: "Claims & Protection", icon: Shield },
  { slug: "mobile-financial-ops", label: "Mobile Financial Ops", icon: Smartphone },
  { slug: "enterprise-observability", label: "Enterprise Observability", icon: Radio },
  { slug: "internal-books", label: "Internal Books", icon: BookOpen },
  { slug: "vendor-bills", label: "Vendor Bills & Pay Planning", icon: Receipt },
  { slug: "tax-compliance", label: "Tax & Compliance", icon: Scale },
  { slug: "financing-marketplace", label: "Financing Marketplace", icon: Landmark },
  { slug: "procurement-inventory", label: "Procurement & Inventory Finance", icon: PackageSearch },
  { slug: "operating-cash", label: "Operating Cash & Internal Buckets", icon: PiggyBank },
  { slug: "payroll-commissions", label: "Payroll & Commissions", icon: Users },
  { slug: "contractor-settlements", label: "Contractor / Partner Settlements", icon: Truck },
]

export const BLITZPAY_FCC_SLUG_SET = new Set(BLITZPAY_FCC_NAV_ITEMS.map((i) => i.slug))

/**
 * Primary commercial module for background prefetch eligibility (mirrors plan `visibleModules` hints).
 * Does not authorize APIs — routes remain authoritative.
 */
export const BLITZPAY_FCC_PREFETCH_MODULE_BY_SLUG: Record<string, BlitzpayCommercialModuleKey> = {
  overview: "financial_command_center",
  "executive-health": "financial_command_center",
  "ai-financial-copilot": "ai_copilot",
  "revenue-optimization": "revenue_optimization",
  "recurring-revenue": "memberships_recurring",
  collections: "collections",
  "billing-profiles": "customer_invoicing",
  "command-center-data": "financial_command_center",
  "multi-entity-finance": "multi_entity_franchise",
  "supplier-network": "supplier_network",
  "claims-protection": "claims_protection",
  "mobile-financial-ops": "mobile_financial_ops",
  "enterprise-observability": "enterprise_observability",
  "internal-books": "general_ledger",
  "vendor-bills": "vendor_ap",
  "tax-compliance": "tax_compliance",
  "financing-marketplace": "financing_marketplace",
  "procurement-inventory": "procurement_inventory",
  "operating-cash": "cash_planning",
  "payroll-commissions": "payroll_accruals",
  "contractor-settlements": "treasury_payouts",
}

/** High-traffic first; enterprise-heavy last (see BlitzPay FCC prefetch spec). */
export const BLITZPAY_FCC_PREFETCH_PRIORITY: readonly string[] = [
  "overview",
  "collections",
  "revenue-optimization",
  "billing-profiles",
  "command-center-data",
  "recurring-revenue",
  "executive-health",
  "ai-financial-copilot",
  "vendor-bills",
  "payroll-commissions",
  "operating-cash",
  "contractor-settlements",
  "claims-protection",
  "mobile-financial-ops",
  "internal-books",
  "tax-compliance",
  "financing-marketplace",
  "procurement-inventory",
  "multi-entity-finance",
  "supplier-network",
  "enterprise-observability",
]

export function getBlitzpayFccPrefetchAllowedSlugSet(
  visibleModules: readonly BlitzpayCommercialModuleKey[],
): Set<string> {
  const visible = new Set(visibleModules)
  const allowed = new Set<string>()
  for (const slug of BLITZPAY_FCC_SLUG_SET) {
    const mod = BLITZPAY_FCC_PREFETCH_MODULE_BY_SLUG[slug]
    if (mod && visible.has(mod)) allowed.add(slug)
  }
  return allowed
}

export function blitzpayFccHref(slug: string): string {
  return `${FCC_BASE}/${slug}`
}
