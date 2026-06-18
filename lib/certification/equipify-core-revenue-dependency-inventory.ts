/**
 * Equipify Core revenue path dependency inventory (EC-4).
 * Metadata only — documents quote → invoice → payment runtime surfaces.
 */

import type { EquipifyCoreDependency } from "@/lib/certification/equipify-core-runtime-inventory"

export const EQUIPIFY_CORE_REVENUE_CERT_QA_MARKER = "equipify-core-revenue-cert-ec-4-v1" as const

export type RevenueDependencyEntry = {
  id: string
  stage: "quote" | "invoice" | "blitzpay" | "portal" | "stripe" | "email"
  surface: string
  routeOrModule: string
  dependencies: EquipifyCoreDependency[]
  criticality: "critical" | "high" | "medium"
  description: string
}

export const EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY: RevenueDependencyEntry[] = [
  // Quotes
  {
    id: "quote-create-ui",
    stage: "quote",
    surface: "Staff UI",
    routeOrModule: "/quotes + CreateWorkOrderModal pattern / components/quotes",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "Create quote with customer, line items, totals.",
  },
  {
    id: "quote-edit-ui",
    stage: "quote",
    surface: "Staff UI",
    routeOrModule: "/quotes",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "high",
    description: "Edit quote line items and status.",
  },
  {
    id: "quote-pdf-api",
    stage: "quote",
    surface: "API",
    routeOrModule: "app/api/organizations/[organizationId]/quotes/[quoteId]/pdf/route.ts",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "generateQuotePdfBuffer via loadQuoteDocumentContext.",
  },
  {
    id: "quote-email-api",
    stage: "quote",
    surface: "API",
    routeOrModule: "app/api/email/quote/route.ts",
    dependencies: ["supabase", "supabase_auth", "resend"],
    criticality: "critical",
    description: "Send quote email with PDF attachment.",
  },
  {
    id: "quote-portal-approve",
    stage: "quote",
    surface: "Portal API",
    routeOrModule: "app/api/portal/quotes/[quoteId]/approve/route.ts",
    dependencies: ["portal_session", "supabase"],
    criticality: "critical",
    description: "Customer approves quote; updates org_quotes status.",
  },
  {
    id: "quote-blitzpay-prepare",
    stage: "quote",
    surface: "BlitzPay API",
    routeOrModule: "app/api/organizations/.../quotes/[quoteId]/blitzpay/prepare-pay/route.ts",
    dependencies: ["stripe_connect", "supabase", "supabase_auth"],
    criticality: "high",
    description: "Optional quote deposit / pay via Connect Checkout.",
  },
  // Invoices
  {
    id: "invoice-create-ui",
    stage: "invoice",
    surface: "Staff UI",
    routeOrModule: "/invoices",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "Create invoice from scratch or work order / quote.",
  },
  {
    id: "invoice-pdf-api",
    stage: "invoice",
    surface: "API",
    routeOrModule: "app/api/organizations/[organizationId]/invoices/[invoiceId]/pdf/route.ts",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "generateInvoicePdfBuffer via loadInvoiceDocumentContext.",
  },
  {
    id: "invoice-email-api",
    stage: "invoice",
    surface: "API",
    routeOrModule: "app/api/email/invoice/route.ts",
    dependencies: ["supabase", "supabase_auth", "resend"],
    criticality: "critical",
    description: "Send invoice email with PDF attachment.",
  },
  {
    id: "invoice-status",
    stage: "invoice",
    surface: "Data",
    routeOrModule: "org_invoices.status",
    dependencies: ["supabase"],
    criticality: "high",
    description: "Draft → sent → paid transitions; void/archive guards.",
  },
  // BlitzPay
  {
    id: "blitzpay-prepare-invoice-pay",
    stage: "blitzpay",
    surface: "API",
    routeOrModule: "lib/blitzpay/blitzpay-prepare-invoice-pay.ts",
    dependencies: ["stripe_connect", "supabase"],
    criticality: "critical",
    description: "prepareBlitzpayInvoiceHostedCheckout — Connect Checkout session.",
  },
  {
    id: "blitzpay-invoice-pay-eligibility",
    stage: "blitzpay",
    surface: "Lib",
    routeOrModule: "lib/blitzpay/invoice-pay-eligibility.ts",
    dependencies: ["supabase"],
    criticality: "critical",
    description: "assertInvoicePayableForBlitzpay balance/status checks.",
  },
  {
    id: "blitzpay-resend-receipt",
    stage: "blitzpay",
    surface: "API",
    routeOrModule: "app/api/organizations/.../invoices/[invoiceId]/blitzpay/resend-receipt/route.ts",
    dependencies: ["stripe_connect", "resend", "supabase", "supabase_auth"],
    criticality: "high",
    description: "Resend payment receipt email after successful charge.",
  },
  {
    id: "blitzpay-idempotency",
    stage: "blitzpay",
    surface: "Lib",
    routeOrModule: "lib/blitzpay/idempotency-keys.ts",
    dependencies: ["stripe_connect"],
    criticality: "high",
    description: "PaymentIntent idempotency keys per org/invoice/attempt.",
  },
  // Portal
  {
    id: "portal-login",
    stage: "portal",
    surface: "UI",
    routeOrModule: "/portal/login",
    dependencies: ["portal_session", "resend", "supabase_auth"],
    criticality: "critical",
    description: "Magic-link customer access.",
  },
  {
    id: "portal-invoice-pay",
    stage: "portal",
    surface: "Portal API",
    routeOrModule: "app/api/portal/invoices/[invoiceId]/blitzpay/prepare-pay/route.ts",
    dependencies: ["portal_session", "stripe_connect", "supabase"],
    criticality: "critical",
    description: "Customer initiates invoice payment in portal.",
  },
  {
    id: "portal-quote-pages",
    stage: "portal",
    surface: "UI",
    routeOrModule: "/portal/quotes, /portal/quotes/[quoteId]",
    dependencies: ["portal_session", "supabase"],
    criticality: "critical",
    description: "Customer quote review and approval UI.",
  },
  {
    id: "portal-blitzpay-eligibility",
    stage: "portal",
    surface: "Lib",
    routeOrModule: "lib/blitzpay/portal-blitzpay-checkout-eligibility.ts",
    dependencies: ["stripe_connect", "supabase"],
    criticality: "high",
    description: "Hosted checkout gating: env flag, org toggle, Connect charges.",
  },
  // Stripe webhooks
  {
    id: "stripe-saas-webhook",
    stage: "stripe",
    surface: "Webhook",
    routeOrModule: "app/api/stripe/webhook/route.ts",
    dependencies: ["stripe_saas", "supabase"],
    criticality: "critical",
    description: "SaaS subscription sync; stripe_webhook_events idempotency.",
  },
  {
    id: "stripe-blitzpay-webhook",
    stage: "stripe",
    surface: "Webhook",
    routeOrModule: "app/api/blitzpay/webhook/route.ts",
    dependencies: ["stripe_connect", "supabase"],
    criticality: "critical",
    description: "Connect payment events; blitzpay_stripe_webhook_events + inbox.",
  },
  // Email
  {
    id: "email-resend-config",
    stage: "email",
    surface: "Env",
    routeOrModule: "lib/email/config.ts",
    dependencies: ["resend"],
    criticality: "critical",
    description: "RESEND_API_KEY + EMAIL_FROM_ADDRESS for transactional send.",
  },
]

export function summarizeRevenueDependencies(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY) {
    counts[entry.stage] = (counts[entry.stage] ?? 0) + 1
  }
  return counts
}
