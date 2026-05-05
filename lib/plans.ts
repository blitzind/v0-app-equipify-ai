import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export const PLAN_IDS = ["solo", "core", "growth", "scale"] as const
export type PlanId = (typeof PLAN_IDS)[number]

export interface Plan {
  id: PlanId
  name: string
  description: string
  priceMonthly: number   // in cents; per month when billed monthly
  priceAnnual: number     // in cents; per month when billed annually (20% off vs monthly)
  seats: number           // max users; -1 = unlimited
  equipmentLimit: number  // max equipment records; -1 = unlimited
  features: string[]
  stripeMonthlyPriceId: string
  stripeAnnualPriceId: string
  badge?: string
  cta: string
  aiLabel?: string
  aiFeatures?: string[]
}

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    description: "Basic access for solo operators.",
    priceMonthly: 6900,
    priceAnnual: 5500,
    seats: 1,
    equipmentLimit: 50,
    features: [
      "1 user",
      "Up to 50 equipment records",
      "Work orders & scheduling",
      "Basic quotes & invoices",
      "Basic customer records",
      "Email notifications",
      "Limited dashboard",
    ],
    stripeMonthlyPriceId: "price_solo_monthly",
    stripeAnnualPriceId: "price_solo_annual",
    cta: "Get started",
  },
  {
    id: "core",
    name: "Core",
    description: "Full operations for small teams.",
    priceMonthly: 19700,
    priceAnnual: 15800,
    seats: 3,
    equipmentLimit: 250,
    features: [
      "Up to 3 users",
      "Up to 250 equipment records",
      "Everything in Solo",
      "Full service history per equipment",
      "Customer portal",
      "Full quotes & invoices",
      "Email reminders",
      "Basic reporting",
    ],
    stripeMonthlyPriceId: "price_core_monthly",
    stripeAnnualPriceId: "price_core_annual",
    cta: "Get started",
  },
  {
    id: "growth",
    name: "Growth",
    description: "Automation, maintenance plans, and visibility for growing teams.",
    priceMonthly: 39700,
    priceAnnual: 31800,
    seats: 10,
    equipmentLimit: 2500,
    badge: "Most Popular",
    features: [
      "Up to 10 users",
      "Up to 2,500 equipment records",
      "Everything in Core",
      "Maintenance plans",
      "Automated reminders",
      "Technician management",
      "Advanced reports",
      "Payment links",
      "Priority support",
    ],
    stripeMonthlyPriceId: "price_growth_monthly",
    stripeAnnualPriceId: "price_growth_annual",
    cta: "Get started",
    aiLabel: "AI Included",
    aiFeatures: [
      "AI Quote Drafting",
      "AI Payment Reminders",
      "AI Customer Summaries",
      "AI Service Notes (limited monthly use)",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    description: "Advanced controls, API access, and AI-driven insights.",
    priceMonthly: 79700,
    priceAnnual: 63800,
    seats: 25,
    equipmentLimit: -1,
    features: [
      "Up to 25 users",
      "Unlimited equipment records",
      "Everything in Growth",
      "AI Insights",
      "Multi-location support",
      "Approval workflows",
      "API access",
      "Advanced analytics",
      "Priority onboarding",
    ],
    stripeMonthlyPriceId: "price_scale_monthly",
    stripeAnnualPriceId: "price_scale_annual",
    cta: "Get started",
    aiLabel: "Advanced AI",
    aiFeatures: [
      "Photo-to-Equipment Intake",
      "Predictive Maintenance Alerts",
      "Smart Dispatch Optimization",
      "Technician Utilization Insights",
      "Weekly Executive AI Reports",
      "Unlimited AI Usage",
    ],
  },
]

export function getPlan(id: PlanId | string): Plan {
  const nid = normalizePlanIdForRead(typeof id === "string" ? id : id)
  return PLANS.find((p) => p.id === nid) ?? PLANS[0]
}
