import type { LucideIcon } from "lucide-react"
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

export function blitzpayFccHref(slug: string): string {
  return `${FCC_BASE}/${slug}`
}
