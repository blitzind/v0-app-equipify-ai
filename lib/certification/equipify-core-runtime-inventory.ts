/**
 * Equipify Core production runtime inventory (EC-1).
 * Metadata only — no network calls, no execution.
 */

export const EQUIPIFY_CORE_CERTIFICATION_QA_MARKER = "equipify-core-certification-ec-1-v1" as const

export const EQUIPIFY_CORE_PRODUCTION_HOST = "https://app.equipify.ai" as const

export const EQUIPIFY_CORE_CERTIFICATION_CATEGORIES = [
  "authentication",
  "onboarding",
  "customers",
  "prospects",
  "work_orders",
  "quotes",
  "invoices",
  "payments",
  "purchase_orders",
  "portal",
  "billing",
  "mobile",
  "notifications",
  "settings",
] as const

export type EquipifyCoreCertificationCategory = (typeof EQUIPIFY_CORE_CERTIFICATION_CATEGORIES)[number]

export const EQUIPIFY_CORE_CRITICALITIES = ["critical", "high", "medium", "low"] as const

export type EquipifyCoreCriticality = (typeof EQUIPIFY_CORE_CRITICALITIES)[number]

export const EQUIPIFY_CORE_DEPENDENCIES = [
  "supabase",
  "supabase_auth",
  "supabase_storage",
  "stripe_saas",
  "stripe_connect",
  "resend",
  "portal_session",
  "quickbooks",
  "twilio",
  "telnyx",
  "vercel",
  "mobile_push",
  "ai_providers",
] as const

export type EquipifyCoreDependency = (typeof EQUIPIFY_CORE_DEPENDENCIES)[number]

export const EQUIPIFY_CORE_RUNTIME_KINDS = [
  "page_route",
  "api_route",
  "webhook",
  "auth_route",
  "mobile_api",
] as const

export type EquipifyCoreRuntimeKind = (typeof EQUIPIFY_CORE_RUNTIME_KINDS)[number]

export type EquipifyCoreRuntimeEntry = {
  id: string
  category: EquipifyCoreCertificationCategory
  kind: EquipifyCoreRuntimeKind
  route: string
  dependencies: EquipifyCoreDependency[]
  criticality: EquipifyCoreCriticality
  description: string
}

/** Human-readable dependency notes for certification docs and summaries. */
export const EQUIPIFY_CORE_DEPENDENCY_INVENTORY: Record<
  EquipifyCoreDependency,
  { label: string; description: string }
> = {
  supabase: {
    label: "Supabase Postgres",
    description: "Tenant data, RLS, org-scoped CRUD for Core operational records.",
  },
  supabase_auth: {
    label: "Supabase Auth",
    description: "Staff login, OAuth, session cookies, org membership resolution.",
  },
  supabase_storage: {
    label: "Supabase Storage",
    description: "Work order attachments, logos, document assets.",
  },
  stripe_saas: {
    label: "Stripe SaaS",
    description: "Workspace subscription checkout, billing portal, SaaS webhooks.",
  },
  stripe_connect: {
    label: "Stripe Connect (BlitzPay)",
    description: "Customer invoice/quote payments, Connect onboarding, BlitzPay webhooks.",
  },
  resend: {
    label: "Resend",
    description: "Transactional email for quotes, invoices, portal invites, notifications.",
  },
  portal_session: {
    label: "Portal session",
    description: "Customer portal magic-link access exchange and scoped portal APIs.",
  },
  quickbooks: {
    label: "QuickBooks Online",
    description: "Optional OAuth integration for customer/catalog/invoice sync.",
  },
  twilio: {
    label: "Twilio",
    description: "Optional SMS workspace and voice (not Growth Engine).",
  },
  telnyx: {
    label: "Telnyx",
    description: "Alternate SMS provider for workspace SMS when configured.",
  },
  vercel: {
    label: "Vercel",
    description: "Production hosting, serverless API routes, cron invocations.",
  },
  mobile_push: {
    label: "Mobile push",
    description: "Technician push device registration and test notifications.",
  },
  ai_providers: {
    label: "AI providers",
    description: "Growth+ AI features (quotes assist, business card scan, AIden).",
  },
}

/**
 * Critical runtime surfaces for Equipify Core production certification.
 * Growth Engine routes are intentionally excluded.
 */
export const EQUIPIFY_CORE_RUNTIME_INVENTORY: EquipifyCoreRuntimeEntry[] = [
  // Authentication
  {
    id: "auth-login-page",
    category: "authentication",
    kind: "page_route",
    route: "/login",
    dependencies: ["supabase_auth", "vercel"],
    criticality: "critical",
    description: "Staff sign-in (email + Google OAuth).",
  },
  {
    id: "auth-callback",
    category: "authentication",
    kind: "auth_route",
    route: "/auth/callback",
    dependencies: ["supabase_auth", "vercel"],
    criticality: "critical",
    description: "OAuth callback handler for web sign-in.",
  },

  // Onboarding
  {
    id: "onboarding-page",
    category: "onboarding",
    kind: "page_route",
    route: "/onboarding",
    dependencies: ["supabase", "supabase_auth", "stripe_saas", "vercel"],
    criticality: "critical",
    description: "New workspace provisioning and plan selection.",
  },
  {
    id: "onboarding-provision-api",
    category: "onboarding",
    kind: "api_route",
    route: "/api/onboarding/provision",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "Creates org, trial subscription row, and initial workspace state.",
  },

  // Customers
  {
    id: "customers-list-page",
    category: "customers",
    kind: "page_route",
    route: "/customers",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Customer list and bulk archive.",
  },
  {
    id: "customers-detail-page",
    category: "customers",
    kind: "page_route",
    route: "/customers/[id]",
    dependencies: ["supabase", "supabase_auth", "stripe_connect", "vercel"],
    criticality: "critical",
    description: "Customer detail, contacts, locations, portal, BlitzPay wallet.",
  },
  {
    id: "customers-bulk-archive-api",
    category: "customers",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/customers/bulk-archive",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "medium",
    description: "Bulk archive customers.",
  },
  {
    id: "customers-business-card-scan-api",
    category: "customers",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/customers/business-card-scan",
    dependencies: ["supabase", "supabase_auth", "ai_providers"],
    criticality: "medium",
    description: "AI business card scan (Growth+ entitlement).",
  },

  // Prospects
  {
    id: "prospects-list-page",
    category: "prospects",
    kind: "page_route",
    route: "/prospects",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Prospect pipeline list and kanban.",
  },
  {
    id: "prospects-api",
    category: "prospects",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/prospects",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "high",
    description: "Prospect CRUD.",
  },
  {
    id: "prospects-convert-api",
    category: "prospects",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/prospects/[prospectId]/convert",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "high",
    description: "Convert prospect to customer.",
  },

  // Work orders
  {
    id: "work-orders-list-page",
    category: "work_orders",
    kind: "page_route",
    route: "/work-orders",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Work order list (client-side org hydration).",
  },
  {
    id: "work-orders-detail-page",
    category: "work_orders",
    kind: "page_route",
    route: "/work-orders/[id]",
    dependencies: ["supabase", "supabase_auth", "supabase_storage", "stripe_connect", "vercel"],
    criticality: "critical",
    description: "Work order detail, completion, field BlitzPay collect, offline sync.",
  },
  {
    id: "dispatch-page",
    category: "work_orders",
    kind: "page_route",
    route: "/dispatch",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Dispatch board and technician assignment.",
  },
  {
    id: "scheduling-events-api",
    category: "work_orders",
    kind: "api_route",
    route: "/api/work-orders/scheduling-events",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "high",
    description: "Scheduling event reads for calendar and dispatch.",
  },

  // Quotes
  {
    id: "quotes-list-page",
    category: "quotes",
    kind: "page_route",
    route: "/quotes",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Quote list, create, send, convert.",
  },
  {
    id: "quotes-pdf-api",
    category: "quotes",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/quotes/[quoteId]/pdf",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "Quote PDF generation.",
  },
  {
    id: "email-quote-api",
    category: "quotes",
    kind: "api_route",
    route: "/api/email/quote",
    dependencies: ["supabase", "resend", "supabase_auth"],
    criticality: "critical",
    description: "Send quote email with PDF attachment.",
  },
  {
    id: "quotes-blitzpay-prepare-pay-api",
    category: "quotes",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/quotes/[quoteId]/blitzpay/prepare-pay",
    dependencies: ["supabase", "stripe_connect", "supabase_auth"],
    criticality: "high",
    description: "Prepare BlitzPay checkout for quote deposit or pay.",
  },

  // Invoices
  {
    id: "invoices-list-page",
    category: "invoices",
    kind: "page_route",
    route: "/invoices",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Invoice list, create, send, collect.",
  },
  {
    id: "invoices-print-page",
    category: "invoices",
    kind: "page_route",
    route: "/organizations/[organizationId]/invoices/[invoiceId]/print",
    dependencies: ["supabase", "vercel"],
    criticality: "high",
    description: "Printable invoice layout.",
  },
  {
    id: "invoices-pdf-api",
    category: "invoices",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/invoices/[invoiceId]/pdf",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "critical",
    description: "Invoice PDF generation.",
  },
  {
    id: "email-invoice-api",
    category: "invoices",
    kind: "api_route",
    route: "/api/email/invoice",
    dependencies: ["supabase", "resend", "supabase_auth"],
    criticality: "critical",
    description: "Send invoice email with PDF attachment.",
  },
  {
    id: "invoices-quickbooks-sync-api",
    category: "invoices",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/invoices/[invoiceId]/quickbooks-sync",
    dependencies: ["supabase", "quickbooks", "supabase_auth"],
    criticality: "medium",
    description: "Push invoice to QuickBooks Online.",
  },

  // Payments / BlitzPay
  {
    id: "payments-settings-page",
    category: "payments",
    kind: "page_route",
    route: "/settings/payments",
    dependencies: ["supabase", "stripe_connect", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Stripe Connect onboarding and BlitzPay workspace settings.",
  },
  {
    id: "invoices-blitzpay-prepare-pay-api",
    category: "payments",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay",
    dependencies: ["supabase", "stripe_connect", "supabase_auth"],
    criticality: "critical",
    description: "Prepare BlitzPay checkout session for invoice payment.",
  },
  {
    id: "invoices-blitzpay-payment-link-api",
    category: "payments",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-link",
    dependencies: ["supabase", "stripe_connect", "supabase_auth"],
    criticality: "high",
    description: "Generate payment link for invoice collection.",
  },
  {
    id: "invoices-blitzpay-resend-receipt-api",
    category: "payments",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/resend-receipt",
    dependencies: ["supabase", "stripe_connect", "resend", "supabase_auth"],
    criticality: "high",
    description: "Resend payment receipt email after successful charge.",
  },
  {
    id: "blitzpay-webhook",
    category: "payments",
    kind: "webhook",
    route: "/api/blitzpay/webhook",
    dependencies: ["stripe_connect", "supabase"],
    criticality: "critical",
    description: "Stripe Connect webhook for invoice/quote payment lifecycle.",
  },
  {
    id: "payment-return-page",
    category: "payments",
    kind: "page_route",
    route: "/payment-return",
    dependencies: ["stripe_connect", "vercel"],
    criticality: "high",
    description: "Post-checkout redirect back to invoice context.",
  },

  // Purchase orders
  {
    id: "purchase-orders-page",
    category: "purchase_orders",
    kind: "page_route",
    route: "/purchase-orders",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "medium",
    description: "Purchase order list and management.",
  },
  {
    id: "purchase-orders-pdf-api",
    category: "purchase_orders",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/purchase-orders/[purchaseOrderId]/pdf",
    dependencies: ["supabase", "supabase_auth"],
    criticality: "medium",
    description: "Purchase order PDF generation.",
  },
  {
    id: "vendors-page",
    category: "purchase_orders",
    kind: "page_route",
    route: "/vendors",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "low",
    description: "Vendor directory for purchase orders.",
  },

  // Portal
  {
    id: "portal-login-page",
    category: "portal",
    kind: "page_route",
    route: "/portal/login",
    dependencies: ["portal_session", "supabase_auth", "resend", "vercel"],
    criticality: "critical",
    description: "Customer portal magic-link login.",
  },
  {
    id: "portal-dashboard-page",
    category: "portal",
    kind: "page_route",
    route: "/portal/dashboard",
    dependencies: ["portal_session", "supabase", "vercel"],
    criticality: "critical",
    description: "Customer portal overview.",
  },
  {
    id: "portal-bootstrap-api",
    category: "portal",
    kind: "api_route",
    route: "/api/portal/bootstrap",
    dependencies: ["portal_session", "supabase"],
    criticality: "critical",
    description: "Portal session bootstrap and org branding.",
  },
  {
    id: "portal-access-exchange-api",
    category: "portal",
    kind: "api_route",
    route: "/api/portal/access/exchange",
    dependencies: ["portal_session", "supabase_auth"],
    criticality: "critical",
    description: "Exchange portal access token for session.",
  },
  {
    id: "portal-quotes-approve-api",
    category: "portal",
    kind: "api_route",
    route: "/api/portal/quotes/[quoteId]/approve",
    dependencies: ["portal_session", "supabase"],
    criticality: "critical",
    description: "Customer approves quote in portal.",
  },
  {
    id: "portal-invoices-prepare-pay-api",
    category: "portal",
    kind: "api_route",
    route: "/api/portal/invoices/[invoiceId]/blitzpay/prepare-pay",
    dependencies: ["portal_session", "stripe_connect", "supabase"],
    criticality: "critical",
    description: "Customer initiates invoice payment in portal.",
  },
  {
    id: "portal-service-requests-api",
    category: "portal",
    kind: "api_route",
    route: "/api/portal/service-requests",
    dependencies: ["portal_session", "supabase"],
    criticality: "high",
    description: "Customer submits and views service requests.",
  },
  {
    id: "portal-settings-page",
    category: "portal",
    kind: "page_route",
    route: "/settings/portal",
    dependencies: ["supabase", "supabase_auth", "resend", "vercel"],
    criticality: "high",
    description: "Staff configures portal invites and access.",
  },

  // Billing (SaaS subscription)
  {
    id: "billing-settings-page",
    category: "billing",
    kind: "page_route",
    route: "/settings/billing",
    dependencies: ["supabase", "stripe_saas", "supabase_auth", "vercel"],
    criticality: "critical",
    description: "Workspace plan, payment method, SaaS invoices, upgrade checkout.",
  },
  {
    id: "billing-checkout-api",
    category: "billing",
    kind: "api_route",
    route: "/api/billing/checkout",
    dependencies: ["stripe_saas", "supabase"],
    criticality: "critical",
    description: "Hosted Stripe checkout for SaaS subscription.",
  },
  {
    id: "stripe-saas-webhook",
    category: "billing",
    kind: "webhook",
    route: "/api/stripe/webhook",
    dependencies: ["stripe_saas", "supabase"],
    criticality: "critical",
    description: "SaaS subscription lifecycle webhook sync.",
  },

  // Mobile
  {
    id: "mobile-push-devices-api",
    category: "mobile",
    kind: "mobile_api",
    route: "/api/organizations/[organizationId]/mobile/push-devices",
    dependencies: ["supabase", "mobile_push", "supabase_auth"],
    criticality: "high",
    description: "Register technician push devices (native companion app).",
  },
  {
    id: "mobile-push-test-api",
    category: "mobile",
    kind: "mobile_api",
    route: "/api/organizations/[organizationId]/mobile/push-devices/test",
    dependencies: ["supabase", "mobile_push", "supabase_auth"],
    criticality: "medium",
    description: "Send test push notification to registered device.",
  },
  {
    id: "blitzpay-mobile-health-api",
    category: "mobile",
    kind: "mobile_api",
    route: "/api/organizations/[organizationId]/blitzpay/mobile/health",
    dependencies: ["supabase", "stripe_connect", "supabase_auth"],
    criticality: "high",
    description: "Mobile financial ops health probe.",
  },
  {
    id: "technicians-today-page",
    category: "mobile",
    kind: "page_route",
    route: "/technicians/today",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Technician field today view (responsive web).",
  },

  // Notifications
  {
    id: "communications-page",
    category: "notifications",
    kind: "page_route",
    route: "/communications",
    dependencies: ["supabase", "resend", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Unified communications feed and send handoff.",
  },
  {
    id: "email-work-order-summary-api",
    category: "notifications",
    kind: "api_route",
    route: "/api/email/work-order-summary",
    dependencies: ["supabase", "resend", "supabase_auth"],
    criticality: "medium",
    description: "Email work order summary to customer contact.",
  },
  {
    id: "sms-workspace-api",
    category: "notifications",
    kind: "api_route",
    route: "/api/organizations/[organizationId]/sms-workspace",
    dependencies: ["supabase", "twilio", "telnyx", "supabase_auth"],
    criticality: "medium",
    description: "Workspace SMS provider configuration.",
  },

  // Settings
  {
    id: "settings-general-page",
    category: "settings",
    kind: "page_route",
    route: "/settings/general",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "medium",
    description: "Organization general settings.",
  },
  {
    id: "settings-team-page",
    category: "settings",
    kind: "page_route",
    route: "/settings/team",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Team invites and seat limits.",
  },
  {
    id: "settings-workspace-page",
    category: "settings",
    kind: "page_route",
    route: "/settings/workspace",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Workspace branding, company profile, invoice defaults.",
  },
  {
    id: "settings-integrations-quickbooks-page",
    category: "settings",
    kind: "page_route",
    route: "/settings/integrations/quickbooks",
    dependencies: ["quickbooks", "supabase_auth", "vercel"],
    criticality: "medium",
    description: "QuickBooks OAuth connection and sync settings.",
  },
  {
    id: "quickbooks-oauth-authorize-api",
    category: "settings",
    kind: "api_route",
    route: "/api/integrations/quickbooks/authorize",
    dependencies: ["quickbooks", "supabase_auth"],
    criticality: "medium",
    description: "Start QuickBooks OAuth flow.",
  },
  {
    id: "dashboard-home-page",
    category: "settings",
    kind: "page_route",
    route: "/",
    dependencies: ["supabase", "supabase_auth", "vercel"],
    criticality: "high",
    description: "Executive dashboard and first-run launchpad.",
  },
]

/** Revenue-path runtime entry IDs that EC-2 must exercise on production. */
export const EQUIPIFY_CORE_CRITICAL_REVENUE_RUNTIME_IDS = [
  "auth-login-page",
  "onboarding-page",
  "customers-list-page",
  "work-orders-list-page",
  "quotes-list-page",
  "email-quote-api",
  "portal-quotes-approve-api",
  "invoices-list-page",
  "email-invoice-api",
  "invoices-blitzpay-prepare-pay-api",
  "invoices-blitzpay-resend-receipt-api",
  "portal-invoices-prepare-pay-api",
  "billing-settings-page",
  "stripe-saas-webhook",
  "blitzpay-webhook",
] as const
