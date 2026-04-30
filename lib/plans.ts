export type PlanId = "starter" | "growth" | "scale" | "enterprise"

export interface Plan {
  id: PlanId
  name: string
  description: string
  priceMonthly: number   // in cents; 0 = custom/contact sales
  priceAnnual: number    // in cents (per month, billed annually); 0 = custom
  seats: number          // max users; -1 = unlimited
  equipmentLimit: number // max equipment records; -1 = unlimited
  features: string[]
  stripeMonthlyPriceId: string
  stripeAnnualPriceId: string
  badge?: string
  cta: string
  isCustomPricing?: boolean
  aiLabel?: string        // e.g. "AI Included", "Advanced AI", "Enterprise AI"; undefined = not included
  aiFeatures?: string[]   // list of AI tools included at this tier
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For small service teams ready to get organized and grow.",
    priceMonthly: 19700,   // $197/mo
    priceAnnual: 15800,    // $158/mo billed annually
    seats: 3,
    equipmentLimit: 250,
    features: [
      "Up to 3 users",
      "Up to 250 equipment records",
      "Work orders & scheduling",
      "Customer portal",
      "Quotes & invoices",
      "Email reminders",
      "Basic reporting",
    ],
    stripeMonthlyPriceId: "price_starter_monthly",
    stripeAnnualPriceId: "price_starter_annual",
    cta: "Start Starter Plan",
    // No AI at Starter
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing teams needing automation, maintenance plans, and visibility.",
    priceMonthly: 39700,   // $397/mo
    priceAnnual: 31800,    // $318/mo billed annually
    seats: 10,
    equipmentLimit: 2500,
    badge: "Most Popular",
    features: [
      "Up to 10 users",
      "Up to 2,500 equipment records",
      "Everything in Starter",
      "Maintenance plans",
      "Automated reminders",
      "Technician management",
      "Advanced reports",
      "Payment links",
      "Priority support",
    ],
    stripeMonthlyPriceId: "price_growth_monthly",
    stripeAnnualPriceId: "price_growth_annual",
    cta: "Upgrade to Growth",
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
    description: "For established operations that need advanced controls and expansion.",
    priceMonthly: 79700,   // $797/mo
    priceAnnual: 63800,    // $638/mo billed annually
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
    cta: "Upgrade to Scale",
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
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations with custom requirements.",
    priceMonthly: 0,
    priceAnnual: 0,
    seats: -1,
    equipmentLimit: -1,
    isCustomPricing: true,
    features: [
      "Unlimited users",
      "SSO / SAML",
      "Dedicated support",
      "Data migration",
      "Custom integrations",
      "White label options",
      "SLA support",
    ],
    stripeMonthlyPriceId: "price_enterprise_monthly",
    stripeAnnualPriceId: "price_enterprise_annual",
    cta: "Contact Sales",
    aiLabel: "Enterprise AI",
    aiFeatures: [
      "Custom AI Workflows",
      "Internal Knowledge AI",
      "Custom Reporting AI",
      "Dedicated AI Strategy Support",
    ],
  },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}
