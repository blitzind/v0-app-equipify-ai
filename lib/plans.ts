export type PlanId = "starter" | "growth" | "enterprise"

export interface Plan {
  id: PlanId
  name: string
  description: string
  priceMonthly: number   // in cents
  priceAnnual: number    // in cents (per month, billed annually)
  seats: number          // max users; -1 = unlimited
  equipmentLimit: number // max equipment records; -1 = unlimited
  features: string[]
  stripeMonthlyPriceId: string
  stripeAnnualPriceId: string
  badge?: string
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For small service teams getting started.",
    priceMonthly: 14900,   // $149/mo
    priceAnnual: 11900,    // $119/mo billed annually
    seats: 5,
    equipmentLimit: 100,
    features: [
      "Up to 5 users",
      "Up to 100 equipment records",
      "Work orders & scheduling",
      "Customer portal",
      "Email notifications",
      "Basic reporting",
    ],
    stripeMonthlyPriceId: "price_starter_monthly",
    stripeAnnualPriceId: "price_starter_annual",
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing teams that need automation and AI.",
    priceMonthly: 39900,   // $399/mo
    priceAnnual: 31900,    // $319/mo billed annually
    seats: 20,
    equipmentLimit: -1,
    badge: "Most Popular",
    features: [
      "Up to 20 users",
      "Unlimited equipment",
      "Everything in Starter",
      "Maintenance plan engine",
      "AI Insights module",
      "SMS & email reminders",
      "White-label branding",
      "Priority support",
    ],
    stripeMonthlyPriceId: "price_growth_monthly",
    stripeAnnualPriceId: "price_growth_annual",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large operations with custom requirements.",
    priceMonthly: 99900,   // $999/mo
    priceAnnual: 79900,    // $799/mo billed annually
    seats: -1,
    equipmentLimit: -1,
    features: [
      "Unlimited users",
      "Unlimited equipment",
      "Everything in Growth",
      "Custom roles & permissions",
      "SSO / SAML",
      "Dedicated account manager",
      "SLA uptime guarantee",
      "Custom integrations",
      "On-premise option",
    ],
    stripeMonthlyPriceId: "price_enterprise_monthly",
    stripeAnnualPriceId: "price_enterprise_annual",
  },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}
