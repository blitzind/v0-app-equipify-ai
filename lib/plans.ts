import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export const PLAN_IDS = ["solo", "core", "growth", "scale"] as const
export type PlanId = (typeof PLAN_IDS)[number]

/** Canonical Stripe Price IDs (Dashboard → Products). Env vars in `stripe-price-map` may override per deploy. */
export const PLAN_PRICE_IDS = {
  solo: {
    monthly: "price_1TTprI2Y5teM2HcUkuvow9to",
    yearly: "price_1TTpuw2Y5teM2HcUWNGnMLdr",
  },
  core: {
    monthly: "price_1TTpsY2Y5teM2HcUoiLUgUsT",
    yearly: "price_1TTpvO2Y5teM2HcU3PdJNocm",
  },
  growth: {
    monthly: "price_1TTpsr2Y5teM2HcUsV8lNRLE",
    yearly: "price_1TTpvr2Y5teM2HcUdWJHgHzR",
  },
  scale: {
    monthly: "price_1TTptB2Y5teM2HcUSmzgCrDS",
    yearly: "price_1TTpwI2Y5teM2HcUV36vm7Rc",
  },
} as const

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
  capabilities?: string[]
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
    stripeMonthlyPriceId: PLAN_PRICE_IDS.solo.monthly,
    stripeAnnualPriceId: PLAN_PRICE_IDS.solo.yearly,
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
    stripeMonthlyPriceId: PLAN_PRICE_IDS.core.monthly,
    stripeAnnualPriceId: PLAN_PRICE_IDS.core.yearly,
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
    stripeMonthlyPriceId: PLAN_PRICE_IDS.growth.monthly,
    stripeAnnualPriceId: PLAN_PRICE_IDS.growth.yearly,
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
    stripeMonthlyPriceId: PLAN_PRICE_IDS.scale.monthly,
    stripeAnnualPriceId: PLAN_PRICE_IDS.scale.yearly,
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
    capabilities: ["aiden_actions"],
  },
]

export function getPlan(id: PlanId | string): Plan {
  const nid = normalizePlanIdForRead(typeof id === "string" ? id : id)
  return PLANS.find((p) => p.id === nid) ?? PLANS[0]
}
