/**
 * Equipify Core revenue path certification (EC-4).
 * Mutation dry-run, payment dry-run, and optional browser checks — no writes, charges, or emails.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import { getBillingAccessState } from "@/lib/billing/access"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import { buildBlitzPayPaymentIntentIdempotencyKey } from "@/lib/blitzpay/idempotency-keys"
import {
  assertInvoicePayableForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import { getPortalBlitzpayHostedCheckoutEligibility } from "@/lib/blitzpay/portal-blitzpay-checkout-eligibility"
import { runBlitzpaySchemaHealthCheck } from "@/lib/blitzpay/blitzpay-schema-health"
import { getOutboundEmailHealth } from "@/lib/email/config"
import { isPortalQuoteCustomerActionableDb } from "@/lib/org-quotes-invoices/quote-approval"
import { getOrgPermissionsForRole } from "@/lib/permissions/model"
import {
  EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
  bootstrapEquipifyCoreCertSupabase,
  resolveCertOrganizationId,
  type CertCheckResult,
  type EnvPresenceStatus,
} from "@/lib/certification/equipify-core-production-certification"
import { EQUIPIFY_CORE_PRODUCTION_HOST } from "@/lib/certification/equipify-core-runtime-inventory"
import {
  EQUIPIFY_CORE_REVENUE_CERT_QA_MARKER,
  EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY,
  summarizeRevenueDependencies,
} from "@/lib/certification/equipify-core-revenue-dependency-inventory"

export type RevenueEnvReport = {
  qa_marker: typeof EQUIPIFY_CORE_REVENUE_CERT_QA_MARKER
  env: Record<string, EnvPresenceStatus>
  checks: CertCheckResult[]
  ok: boolean
  executed_at: string
}

export type MutationDryRunReport = {
  qa_marker: typeof EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER
  mode: "mutation-dry-run"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  organization_id: string | null
  organization_source: string | null
  supabase_credential_source: string | null
  revenue_dependency_count: number
  revenue_dependency_stages: Record<string, number>
  env: Record<string, EnvPresenceStatus>
  checks: CertCheckResult[]
  fixtures: {
    customer_id: string | null
    quote_id: string | null
    invoice_id: string | null
  }
  ok: boolean
  executed_at: string
}

export type PaymentDryRunReport = {
  qa_marker: typeof EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER
  mode: "payment-dry-run"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  organization_id: string | null
  organization_source: string | null
  supabase_credential_source: string | null
  blitzpay_invoice_pay_enabled: boolean
  connect: {
    stripe_connect_account_id: string | null
    stripe_charges_enabled: boolean | null
  } | null
  portal_hosted_checkout: {
    hostedCheckoutAvailable: boolean
    unavailableReason: string | null
  } | null
  env: Record<string, EnvPresenceStatus>
  checks: CertCheckResult[]
  ok: boolean
  executed_at: string
}

export type RevenueBrowserReport = {
  qa_marker: typeof EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER
  mode: "browser-revenue"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  storage_state: string | null
  checks: CertCheckResult[]
  fixtures: {
    customer_id: string | null
    quote_id: string | null
    invoice_id: string | null
  }
  ok: boolean
  executed_at: string
}

function isPresent(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0
}

function envPresence(key: string, optional = false): EnvPresenceStatus {
  if (!isPresent(process.env[key])) {
    return optional ? "optional_missing" : "missing"
  }
  return "present"
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(process.cwd(), relativePath))
}

const REVENUE_ROUTE_FILES = [
  {
    id: "route_file_quote_pdf",
    category: "quotes",
    path: "app/api/organizations/[organizationId]/quotes/[quoteId]/pdf/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_quote_email",
    category: "quotes",
    path: "app/api/email/quote/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_invoice_pdf",
    category: "invoices",
    path: "app/api/organizations/[organizationId]/invoices/[invoiceId]/pdf/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_invoice_email",
    category: "invoices",
    path: "app/api/email/invoice/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_portal_quote_approve",
    category: "portal",
    path: "app/api/portal/quotes/[quoteId]/approve/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_portal_invoice_prepare_pay",
    category: "portal",
    path: "app/api/portal/invoices/[invoiceId]/blitzpay/prepare-pay/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_blitzpay_prepare_pay",
    category: "payments",
    path: "app/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_blitzpay_resend_receipt",
    category: "payments",
    path: "app/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/resend-receipt/route.ts",
    criticality: "high" as const,
  },
  {
    id: "route_file_stripe_webhook",
    category: "billing",
    path: "app/api/stripe/webhook/route.ts",
    criticality: "critical" as const,
  },
  {
    id: "route_file_blitzpay_webhook",
    category: "payments",
    path: "app/api/blitzpay/webhook/route.ts",
    criticality: "critical" as const,
  },
] as const

const REVENUE_LIB_FILES = [
  { id: "lib_quote_pdf", category: "quotes", path: "lib/quotes/generate-quote-pdf.ts" },
  { id: "lib_invoice_pdf", category: "invoices", path: "lib/invoices/generate-invoice-pdf.ts" },
  { id: "lib_quote_approval", category: "quotes", path: "lib/org-quotes-invoices/quote-approval.ts" },
  { id: "lib_blitzpay_prepare", category: "payments", path: "lib/blitzpay/blitzpay-prepare-invoice-pay.ts" },
  { id: "lib_blitzpay_idempotency", category: "payments", path: "lib/blitzpay/idempotency-keys.ts" },
] as const

export function runEquipifyCoreRevenueEnvVerification(): RevenueEnvReport {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []
  const env: Record<string, EnvPresenceStatus> = {}

  const setEnv = (key: string, optional = false) => {
    env[key] = envPresence(key, optional)
  }

  setEnv("STRIPE_SECRET_KEY")
  setEnv("STRIPE_WEBHOOK_SECRET")
  setEnv("STRIPE_BLITZPAY_WEBHOOK_SECRET")
  setEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", true)
  env.BLITZPAY_INVOICE_PAY_ENABLED = isBlitzPayInvoicePayEnabledEnv() ? "present" : "disabled_by_flag"
  setEnv("RESEND_API_KEY")
  const emailHealth = getOutboundEmailHealth()
  env.EMAIL_FROM_ADDRESS = emailHealth.hasFromAddress ? "present" : "optional_missing"
  env.PORTAL_SESSION_DEPENDENCIES =
    envPresence("NEXT_PUBLIC_SUPABASE_URL") === "present" &&
    envPresence("SUPABASE_SERVICE_ROLE_KEY") === "present"
      ? "present"
      : "missing"

  const revenueKeys: Array<{ key: string; category: string; label: string; optional?: boolean }> = [
    { key: "STRIPE_SECRET_KEY", category: "payments", label: "Stripe secret key" },
    { key: "STRIPE_WEBHOOK_SECRET", category: "billing", label: "Stripe SaaS webhook secret" },
    { key: "STRIPE_BLITZPAY_WEBHOOK_SECRET", category: "payments", label: "BlitzPay webhook secret" },
    { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", category: "payments", label: "Stripe publishable key", optional: true },
    { key: "RESEND_API_KEY", category: "email", label: "Resend API key" },
  ]

  for (const item of revenueKeys) {
    const status = env[item.key]
    const isOptionalMissing = item.optional && status === "optional_missing"
    const localVercelRun = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"
    const sensitiveBlockedLocally =
      localVercelRun &&
      !item.optional &&
      status === "missing" &&
      ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_BLITZPAY_WEBHOOK_SECRET", "RESEND_API_KEY"].includes(
        item.key,
      )
    checks.push({
      id: `revenue_env_${item.key.toLowerCase()}`,
      category: item.category,
      status: sensitiveBlockedLocally ? "blocked" : status === "present" || isOptionalMissing ? "pass" : "fail",
      detail: sensitiveBlockedLocally
        ? `${item.label}: missing locally (Vercel Sensitive secret not materialized; runtime on Vercel may still be configured).`
        : `${item.label}: ${status}`,
      criticality: item.optional ? "medium" : "critical",
    })
  }

  checks.push({
    id: "revenue_env_blitzpay_invoice_pay_flag",
    category: "payments",
    status: "pass",
    detail: isBlitzPayInvoicePayEnabledEnv()
      ? "BLITZPAY_INVOICE_PAY_ENABLED=true."
      : "BLITZPAY_INVOICE_PAY_ENABLED not true (disabled_by_flag — payment dry-run documents prerequisites only).",
    criticality: "high",
  })

  checks.push({
    id: "revenue_env_email_sender",
    category: "email",
    status:
      emailHealth.configured
        ? "pass"
        : process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"
          ? "blocked"
          : "fail",
    detail: emailHealth.configured
      ? "Resend + from-address configured for quote/invoice email."
      : process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"
        ? "Email sender/API key not materialized locally (Vercel Sensitive)."
        : `Email not fully configured: ${emailHealth.reason ?? "missing sender or API key"}.`,
    criticality: "critical",
  })

  checks.push({
    id: "revenue_env_portal_session",
    category: "portal",
    status: env.PORTAL_SESSION_DEPENDENCIES === "present" ? "pass" : "fail",
    detail:
      env.PORTAL_SESSION_DEPENDENCIES === "present"
        ? "Portal session dependencies present (Supabase URL + service role)."
        : "Portal session dependencies missing.",
    criticality: "high",
  })

  const ok = !checks.some(
    (c) => c.status === "fail" && (c.criticality === "critical" || c.criticality === "high"),
  )

  return {
    qa_marker: EQUIPIFY_CORE_REVENUE_CERT_QA_MARKER,
    env,
    checks,
    ok,
    executed_at,
  }
}

async function resolveRevenueFixtures(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ customer_id: string | null; quote_id: string | null; invoice_id: string | null }> {
  const customerId = process.env.EQUIPIFY_CORE_CERT_CUSTOMER_ID?.trim() || null
  const quoteId = process.env.EQUIPIFY_CORE_CERT_QUOTE_ID?.trim() || null
  const invoiceId = process.env.EQUIPIFY_CORE_CERT_INVOICE_ID?.trim() || null

  let resolvedCustomer = customerId
  if (!resolvedCustomer) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedCustomer = data?.id ?? null
  }

  let resolvedQuote = quoteId
  if (!resolvedQuote) {
    const { data } = await admin
      .from("org_quotes")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedQuote = data?.id ?? null
  }

  let resolvedInvoice = invoiceId
  if (!resolvedInvoice) {
    const { data } = await admin
      .from("org_invoices")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedInvoice = data?.id ?? null
  }

  return {
    customer_id: resolvedCustomer,
    quote_id: resolvedQuote,
    invoice_id: resolvedInvoice,
  }
}

async function bootstrapCertContext(): Promise<
  | {
      admin: SupabaseClient
      organizationId: string
      organization_source: string
      supabase_credential_source: string
      checks: CertCheckResult[]
    }
  | { checks: CertCheckResult[]; failed: true }
> {
  const checks: CertCheckResult[] = []
  const boot = await bootstrapEquipifyCoreCertSupabase()
  if (!boot) {
    checks.push({
      id: "supabase_bootstrap",
      category: "platform",
      status: "blocked",
      detail:
        "Supabase production credentials unavailable (link Supabase CLI project or inject Vercel production env).",
      criticality: "critical",
    })
    return { checks, failed: true }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  checks.push({
    id: "supabase_bootstrap",
    category: "platform",
    status: "pass",
    detail: `Supabase service-role client bootstrapped (${boot.source}).`,
    criticality: "critical",
  })

  const orgResolution = await resolveCertOrganizationId(admin)
  if (!orgResolution) {
    checks.push({
      id: "resolve_cert_organization",
      category: "platform",
      status: "blocked",
      detail: "Could not resolve cert organization.",
      criticality: "critical",
    })
    return { checks, failed: true }
  }

  checks.push({
    id: "resolve_cert_organization",
    category: "platform",
    status: "pass",
    detail: `Cert organization resolved via ${orgResolution.source}.`,
    criticality: "critical",
  })

  return {
    admin,
    organizationId: orgResolution.organizationId,
    organization_source: orgResolution.source,
    supabase_credential_source: boot.source,
    checks,
  }
}

function pushRouteFileChecks(checks: CertCheckResult[]): void {
  for (const route of REVENUE_ROUTE_FILES) {
    const exists = fileExists(route.path)
    checks.push({
      id: route.id,
      category: route.category,
      status: exists ? "pass" : "fail",
      detail: exists ? `Route module present: ${route.path}` : `Missing route module: ${route.path}`,
      criticality: route.criticality,
    })
  }
  for (const lib of REVENUE_LIB_FILES) {
    const exists = fileExists(lib.path)
    checks.push({
      id: lib.id,
      category: lib.category,
      status: exists ? "pass" : "fail",
      detail: exists ? `Library present: ${lib.path}` : `Missing library: ${lib.path}`,
      criticality: "high",
    })
  }
}

export async function runEquipifyCoreMutationDryRunChecks(): Promise<MutationDryRunReport> {
  const executed_at = new Date().toISOString()
  const envReport = runEquipifyCoreRevenueEnvVerification()
  const ctx = await bootstrapCertContext()

  if ("failed" in ctx) {
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "mutation-dry-run",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: null,
      organization_source: null,
      supabase_credential_source: null,
      revenue_dependency_count: EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY.length,
      revenue_dependency_stages: summarizeRevenueDependencies(),
      env: envReport.env,
      checks: [...envReport.checks, ...ctx.checks],
      fixtures: { customer_id: null, quote_id: null, invoice_id: null },
      ok: false,
      executed_at,
    }
  }

  const { admin, organizationId, organization_source, supabase_credential_source, checks } = ctx
  pushRouteFileChecks(checks)

  checks.push({
    id: "revenue_dependency_inventory",
    category: "quotes",
    status: "pass",
    detail: `${EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY.length} revenue dependency entries inventoried (EC-4).`,
    criticality: "medium",
  })

  const permissionCaps = ["canEditQuotes", "canViewQuotes", "canEditInvoices", "canViewFinancials"] as const
  const ownerPerms = getOrgPermissionsForRole("owner")
  for (const cap of permissionCaps) {
    const ownerHas = Boolean(ownerPerms[cap])
    checks.push({
      id: `permission_${cap}`,
      category: "quotes",
      status: ownerHas ? "pass" : "fail",
      detail: ownerHas
        ? `Owner role grants ${cap} (permission model ready for quote/invoice mutations).`
        : `Owner role missing ${cap}.`,
      criticality: "critical",
    })
  }

  const subscription = await getOrganizationSubscription(admin, organizationId)
  const billingAccess = getBillingAccessState(subscription)
  checks.push({
    id: "billing_allow_record_creation",
    category: "billing",
    status: billingAccess.allowRecordCreation ? "pass" : "blocked",
    detail: billingAccess.allowRecordCreation
      ? `Billing access allows record creation (level=${billingAccess.level}).`
      : `Billing access blocks record creation (level=${billingAccess.level}) — quote/invoice create would be gated.`,
    criticality: "critical",
  })

  const fixtures = await resolveRevenueFixtures(admin, organizationId)
  checks.push({
    id: "fixture_customer_available",
    category: "customers",
    status: fixtures.customer_id ? "pass" : "blocked",
    detail: fixtures.customer_id
      ? `Cert org has customer fixture (${fixtures.customer_id}).`
      : "No customer on cert org — quote/invoice create requires customer (set EQUIPIFY_CORE_CERT_CUSTOMER_ID).",
    criticality: "high",
  })

  const lineItemsProbe = await admin
    .from("org_quotes")
    .select("id, line_items")
    .eq("organization_id", organizationId)
    .limit(1)
  checks.push({
    id: "schema_org_quotes_line_items",
    category: "quotes",
    status: lineItemsProbe.error ? "fail" : "pass",
    detail: lineItemsProbe.error
      ? `org_quotes.line_items unreadable: ${lineItemsProbe.error.message}`
      : "org_quotes.line_items column readable (line item prerequisites).",
    criticality: "critical",
  })

  const invoicePaymentsProbe = await admin
    .from("org_invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .limit(1)
  checks.push({
    id: "schema_org_invoice_payments",
    category: "invoices",
    status: invoicePaymentsProbe.error ? "fail" : "pass",
    detail: invoicePaymentsProbe.error
      ? `org_invoice_payments unreadable: ${invoicePaymentsProbe.error.message}`
      : "org_invoice_payments table readable (payment allocation prerequisites).",
    criticality: "high",
  })

  const approvalStatuses = ["sent", "pending_approval", "approved", "draft", "void"]
  const approvalResults = approvalStatuses.map((s) => `${s}=${isPortalQuoteCustomerActionableDb(s)}`)
  checks.push({
    id: "quote_portal_approval_rules",
    category: "quotes",
    status: "pass",
    detail: `Portal approval eligibility evaluated (no DB write): ${approvalResults.join(", ")}.`,
    criticality: "high",
  })

  checks.push({
    id: "quote_pdf_dependencies",
    category: "quotes",
    status:
      fileExists("lib/quotes/load-quote-document-context.ts") &&
      fileExists("lib/quotes/generate-quote-pdf.ts")
        ? "pass"
        : "fail",
    detail: "Quote PDF pipeline modules present (load context + generate buffer).",
    criticality: "critical",
  })

  checks.push({
    id: "invoice_pdf_dependencies",
    category: "invoices",
    status:
      fileExists("lib/invoices/load-invoice-document-context.ts") &&
      fileExists("lib/invoices/generate-invoice-pdf.ts")
        ? "pass"
        : "fail",
    detail: "Invoice PDF pipeline modules present (load context + generate buffer).",
    criticality: "critical",
  })

  checks.push({
    id: "email_send_not_invoked",
    category: "email",
    status: "pass",
    detail: "Mutation dry-run did not call /api/email/quote or /api/email/invoice.",
    criticality: "critical",
  })

  checks.push({
    id: "portal_quote_page_route",
    category: "portal",
    status: fileExists("app/(portal)/portal/quotes/[quoteId]/page.tsx") ? "pass" : "fail",
    detail: "Portal quote detail page module present.",
    criticality: "high",
  })

  checks.push({
    id: "portal_invoice_page_route",
    category: "portal",
    status: fileExists("app/(portal)/portal/invoices/[invoiceId]/page.tsx") ? "pass" : "fail",
    detail: "Portal invoice detail page module present.",
    criticality: "high",
  })

  checks.push({
    id: "no_db_mutations",
    category: "platform",
    status: "pass",
    detail: "Mutation dry-run performed read-only Supabase selects and static analysis only.",
    criticality: "critical",
  })

  const ok = !checks.some(
    (c) =>
      (c.status === "fail" || c.status === "blocked") &&
      (c.criticality === "critical" || c.criticality === "high"),
  )

  return {
    qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
    mode: "mutation-dry-run",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    organization_id: organizationId,
    organization_source,
    supabase_credential_source,
    revenue_dependency_count: EQUIPIFY_CORE_REVENUE_DEPENDENCY_INVENTORY.length,
    revenue_dependency_stages: summarizeRevenueDependencies(),
    env: envReport.env,
    checks,
    fixtures,
    ok,
    executed_at,
  }
}

async function probeWebhookReachable(
  path: string,
  method: "POST",
): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = `${EQUIPIFY_CORE_PRODUCTION_HOST}${path}`
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    })
    const acceptable = [400, 401, 403, 503]
    return {
      ok: acceptable.includes(response.status),
      status: response.status,
      detail: `${method} ${path} → HTTP ${response.status} (handler reachable; no valid Stripe signature).`,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: `${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function runEquipifyCorePaymentDryRunChecks(): Promise<PaymentDryRunReport> {
  const executed_at = new Date().toISOString()
  const envReport = runEquipifyCoreRevenueEnvVerification()
  const ctx = await bootstrapCertContext()

  if ("failed" in ctx) {
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "payment-dry-run",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: null,
      organization_source: null,
      supabase_credential_source: null,
      blitzpay_invoice_pay_enabled: isBlitzPayInvoicePayEnabledEnv(),
      connect: null,
      portal_hosted_checkout: null,
      env: envReport.env,
      checks: [...envReport.checks, ...ctx.checks],
      ok: false,
      executed_at,
    }
  }

  const { admin, organizationId, organization_source, supabase_credential_source, checks } = ctx
  const blitzpayEnabled = isBlitzPayInvoicePayEnabledEnv()

  checks.push({
    id: "blitzpay_invoice_pay_env_flag",
    category: "payments",
    status: blitzpayEnabled ? "pass" : "blocked",
    detail: blitzpayEnabled
      ? "BLITZPAY_INVOICE_PAY_ENABLED=true — invoice pay APIs ungated."
      : "BLITZPAY_INVOICE_PAY_ENABLED not true — live payment session creation blocked by design (prerequisites validated only).",
    criticality: "critical",
  })

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_charges_enabled")
    .eq("id", organizationId)
    .maybeSingle()

  const connect = orgRow
    ? {
        stripe_connect_account_id: (orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? null,
        stripe_charges_enabled: Boolean((orgRow as { stripe_charges_enabled?: boolean }).stripe_charges_enabled),
      }
    : null

  checks.push({
    id: "connect_account_on_org",
    category: "payments",
    status: orgErr ? "fail" : connect?.stripe_connect_account_id ? "pass" : "blocked",
    detail: orgErr
      ? `organizations Connect read failed: ${orgErr.message}`
      : connect?.stripe_connect_account_id
        ? `Connect account present on cert org; charges_enabled=${connect.stripe_charges_enabled}.`
        : "No stripe_connect_account_id on cert org — BlitzPay collect blocked until Connect onboarding.",
    criticality: "critical",
  })

  const portalEligibility = await getPortalBlitzpayHostedCheckoutEligibility(admin, organizationId)
  checks.push({
    id: "portal_hosted_checkout_eligibility",
    category: "portal",
    status: portalEligibility.hostedCheckoutAvailable ? "pass" : "blocked",
    detail: portalEligibility.hostedCheckoutAvailable
      ? "Portal hosted checkout eligibility satisfied."
      : `Portal hosted checkout unavailable: ${portalEligibility.unavailableReason ?? "unknown"}.`,
    criticality: "high",
  })

  try {
    const schemaHealth = await runBlitzpaySchemaHealthCheck(admin)
    checks.push({
      id: "blitzpay_schema_health",
      category: "payments",
      status: schemaHealth.ok ? "pass" : "fail",
      detail: schemaHealth.ok
        ? "BlitzPay schema health OK (critical tables probed)."
        : schemaHealth.ok === false
          ? `BlitzPay schema issue (${schemaHealth.kind}): ${"missing" in schemaHealth ? schemaHealth.missing : schemaHealth.detail}.`
          : "BlitzPay schema health failed.",
      criticality: "critical",
    })
  } catch (error) {
    checks.push({
      id: "blitzpay_schema_health",
      category: "payments",
      status: "fail",
      detail: `BlitzPay schema health check threw: ${error instanceof Error ? error.message : String(error)}`,
      criticality: "critical",
    })
  }

  for (const table of ["stripe_webhook_events", "blitzpay_stripe_webhook_events", "blitzpay_webhook_inbox"] as const) {
    const probe = await admin.from(table).select("*").limit(1)
    checks.push({
      id: `idempotency_table_${table}`,
      category: "payments",
      status: probe.error ? "fail" : "pass",
      detail: probe.error
        ? `${table} unreadable: ${probe.error.message}`
        : `${table} readable (webhook idempotency / inbox).`,
      criticality: "critical",
    })
  }

  try {
    const sampleKey = buildBlitzPayPaymentIntentIdempotencyKey({
      organizationId,
      orgInvoiceId: "00000000-0000-4000-8000-000000000001",
      attemptToken: "cert-dry-run",
    })
    checks.push({
      id: "blitzpay_idempotency_key_builder",
      category: "payments",
      status: sampleKey.startsWith("blitzpay:pi:v1:") ? "pass" : "fail",
      detail: "buildBlitzPayPaymentIntentIdempotencyKey produces stable v1 key shape.",
      criticality: "high",
    })
  } catch (error) {
    checks.push({
      id: "blitzpay_idempotency_key_builder",
      category: "payments",
      status: "fail",
      detail: `Idempotency key builder failed: ${error instanceof Error ? error.message : String(error)}`,
      criticality: "high",
    })
  }

  const stripeWebhookProbe = await probeWebhookReachable("/api/stripe/webhook", "POST")
  checks.push({
    id: "webhook_stripe_reachable",
    category: "billing",
    status: stripeWebhookProbe.ok ? "pass" : "fail",
    detail: stripeWebhookProbe.detail,
    criticality: "critical",
  })

  const blitzpayWebhookProbe = await probeWebhookReachable("/api/blitzpay/webhook", "POST")
  checks.push({
    id: "webhook_blitzpay_reachable",
    category: "payments",
    status: blitzpayWebhookProbe.ok ? "pass" : "fail",
    detail: blitzpayWebhookProbe.detail,
    criticality: "critical",
  })

  const preparePayPath = `/api/organizations/${organizationId}/invoices/00000000-0000-4000-8000-000000000099/blitzpay/prepare-pay`
  const prepareProbe = await fetch(`${EQUIPIFY_CORE_PRODUCTION_HOST}${preparePayPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => null)
  checks.push({
    id: "prepare_pay_route_auth_gate",
    category: "payments",
    status: prepareProbe && [401, 403, 404].includes(prepareProbe.status) ? "pass" : "fail",
    detail: prepareProbe
      ? `POST prepare-pay without session → HTTP ${prepareProbe.status} (no Stripe session created).`
      : "prepare-pay route probe failed (network).",
    criticality: "high",
  })

  const fixtures = await resolveRevenueFixtures(admin, organizationId)
  if (fixtures.invoice_id) {
    try {
      const inv = await loadInvoiceForBlitzpayPay(admin, organizationId, fixtures.invoice_id)
      if (!inv) {
        checks.push({
          id: "invoice_payable_dry_run",
          category: "invoices",
          status: "skipped",
          detail: `Fixture invoice ${fixtures.invoice_id} not found.`,
          criticality: "medium",
        })
      } else {
        const paid = await sumNetRecordedPaymentsCentsForBlitzpay(admin, organizationId, fixtures.invoice_id)
        try {
          assertInvoicePayableForBlitzpay(inv, paid)
          checks.push({
            id: "invoice_payable_dry_run",
            category: "invoices",
            status: "pass",
            detail: `Fixture invoice ${fixtures.invoice_id} passes assertInvoicePayableForBlitzpay (status=${inv.status}, balance due).`,
            criticality: "high",
          })
        } catch (payErr) {
          checks.push({
            id: "invoice_payable_dry_run",
            category: "invoices",
            status: "blocked",
            detail: `Fixture invoice ${fixtures.invoice_id} not payable: ${payErr instanceof Error ? payErr.message : String(payErr)}.`,
            criticality: "high",
          })
        }
      }
    } catch (error) {
      checks.push({
        id: "invoice_payable_dry_run",
        category: "invoices",
        status: "fail",
        detail: `Invoice payability read failed: ${error instanceof Error ? error.message : String(error)}`,
        criticality: "high",
      })
    }
  } else {
    checks.push({
      id: "invoice_payable_dry_run",
      category: "invoices",
      status: "skipped",
      detail: "No fixture invoice on cert org — payability rules not exercised (set EQUIPIFY_CORE_CERT_INVOICE_ID).",
      criticality: "medium",
    })
  }

  const receiptPath = "app/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/resend-receipt/route.ts"
  const receiptRoute = fileExists(receiptPath) ? readFileSync(resolve(process.cwd(), receiptPath), "utf8") : ""
  checks.push({
    id: "receipt_route_dependencies",
    category: "payments",
    status: receiptRoute.includes("requireAnyOrgPermission") ? "pass" : "fail",
    detail: receiptRoute
      ? "Resend-receipt route enforces org permission gate."
      : `Missing resend-receipt route: ${receiptPath}`,
    criticality: "medium",
  })

  checks.push({
    id: "no_stripe_session_created",
    category: "payments",
    status: "pass",
    detail: "Payment dry-run did not call Stripe Checkout or PaymentIntent create APIs.",
    criticality: "critical",
  })

  checks.push({
    id: "no_payment_emails_sent",
    category: "email",
    status: "pass",
    detail: "Payment dry-run did not invoke resend-receipt or invoice email APIs.",
    criticality: "critical",
  })

  const ok = !checks.some(
    (c) =>
      c.status === "fail" &&
      (c.criticality === "critical" || c.criticality === "high"),
  )

  return {
    qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
    mode: "payment-dry-run",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    organization_id: organizationId,
    organization_source,
    supabase_credential_source,
    blitzpay_invoice_pay_enabled: blitzpayEnabled,
    connect,
    portal_hosted_checkout: {
      hostedCheckoutAvailable: portalEligibility.hostedCheckoutAvailable,
      unavailableReason: portalEligibility.unavailableReason,
    },
    env: envReport.env,
    checks,
    ok,
    executed_at,
  }
}

function resolveStaffStorageStatePath(): string | null {
  const candidates = [
    process.env.EQUIPIFY_CORE_CERT_STORAGE_STATE?.trim(),
    process.env.GROWTH_CERT_STORAGE_STATE?.trim(),
    "scripts/.growth-cert-storage-state.json",
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const absolute = resolve(process.cwd(), candidate)
    if (existsSync(absolute)) return absolute
  }
  return null
}

export async function runEquipifyCoreRevenueBrowserChecks(): Promise<RevenueBrowserReport> {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []
  const storageState = resolveStaffStorageStatePath()

  if (!storageState) {
    checks.push({
      id: "browser_auth_storage_state",
      category: "authentication",
      status: "skipped",
      detail:
        "No EQUIPIFY_CORE_CERT_STORAGE_STATE or scripts/.growth-cert-storage-state.json — browser revenue cert skipped.",
      criticality: "high",
    })
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "browser-revenue",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      storage_state: null,
      checks,
      fixtures: { customer_id: null, quote_id: null, invoice_id: null },
      ok: true,
      executed_at,
    }
  }

  let chromium: typeof import("@playwright/test").chromium
  try {
    ;({ chromium } = await import("@playwright/test"))
  } catch {
    checks.push({
      id: "browser_playwright_available",
      category: "platform",
      status: "blocked",
      detail: "@playwright/test not available — run pnpm screenshots:install.",
      criticality: "high",
    })
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "browser-revenue",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      storage_state: storageState,
      checks,
      fixtures: { customer_id: null, quote_id: null, invoice_id: null },
      ok: false,
      executed_at,
    }
  }

  const boot = await bootstrapEquipifyCoreCertSupabase()
  let fixtures = { customer_id: null as string | null, quote_id: null as string | null, invoice_id: null as string | null }
  if (boot) {
    const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    const org = await resolveCertOrganizationId(admin)
    if (org) {
      fixtures = await resolveRevenueFixtures(admin, org.organizationId)
    }
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  const navTimeout = 45_000

  async function pageShowsRestrictedNotice(): Promise<boolean> {
    const restricted = page.getByText(/restricted|don't have permission|not authorized/i)
    return (await restricted.count()) > 0
  }

  async function findCreateButton(...patterns: RegExp[]) {
    for (const pattern of patterns) {
      const btn = page.getByRole("button", { name: pattern })
      if ((await btn.count()) > 0) return btn.first()
    }
    return null
  }

  try {
    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/quotes`, {
      waitUntil: "domcontentloaded",
      timeout: navTimeout,
    })
    const onLogin = page.url().includes("/login")
    checks.push({
      id: "browser_quotes_page_auth",
      category: "quotes",
      status: onLogin ? "fail" : "pass",
      detail: onLogin ? "Storage state invalid — redirected to /login." : "Authenticated /quotes loaded.",
      criticality: "critical",
    })

    if (!onLogin) {
      await page.waitForTimeout(2000)
      const restricted = await pageShowsRestrictedNotice()
      const newQuoteBtn = restricted ? null : await findCreateButton(/new quote/i, /^new$/i)
      checks.push({
        id: "browser_quotes_create_ui",
        category: "quotes",
        status: restricted ? "blocked" : newQuoteBtn ? "pass" : "fail",
        detail: restricted
          ? "Quotes page shows permission restriction for storage-state user."
          : newQuoteBtn
            ? "New Quote button visible."
            : "New Quote button not found.",
        criticality: "high",
      })

      if (newQuoteBtn) {
        await newQuoteBtn.click({ timeout: 10_000 }).catch(() => undefined)
        await page.waitForTimeout(800)
        const modal = page.getByRole("dialog")
        checks.push({
          id: "browser_quotes_create_modal",
          category: "quotes",
          status: (await modal.count()) > 0 ? "pass" : "fail",
          detail:
            (await modal.count()) > 0
              ? "New Quote modal opened (no submit)."
              : "New Quote modal did not open.",
          criticality: "high",
        })
        await page.keyboard.press("Escape").catch(() => undefined)
      }

      if (fixtures.quote_id) {
        const quoteRow = page.getByRole("row").filter({ hasText: /quote/i })
        checks.push({
          id: "browser_quotes_list_render",
          category: "quotes",
          status: (await quoteRow.count()) > 0 ? "pass" : "blocked",
          detail:
            (await quoteRow.count()) > 0
              ? "Quotes table renders rows."
              : "No quote rows visible (cert org may have zero quotes).",
          criticality: "medium",
        })
      }
    }

    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/invoices`, {
      waitUntil: "domcontentloaded",
      timeout: navTimeout,
    })
    const invoicesLogin = page.url().includes("/login")
    checks.push({
      id: "browser_invoices_page_auth",
      category: "invoices",
      status: invoicesLogin ? "fail" : "pass",
      detail: invoicesLogin ? "Redirected to login on /invoices." : "Authenticated /invoices loaded.",
      criticality: "critical",
    })

    if (!invoicesLogin) {
      await page.waitForTimeout(2000)
      const restricted = await pageShowsRestrictedNotice()
      const newInvoiceBtn = restricted ? null : await findCreateButton(/new invoice/i, /^new$/i)
      checks.push({
        id: "browser_invoices_create_ui",
        category: "invoices",
        status: restricted ? "blocked" : newInvoiceBtn ? "pass" : "fail",
        detail: restricted
          ? "Invoices page shows permission restriction for storage-state user."
          : newInvoiceBtn
            ? "New Invoice button visible."
            : "New Invoice button not found.",
        criticality: "high",
      })
    }

    await page.goto(`${EQUIPIFY_CORE_PRODUCTION_HOST}/portal/login`, {
      waitUntil: "domcontentloaded",
      timeout: navTimeout,
    })
    checks.push({
      id: "browser_portal_login_page",
      category: "portal",
      status: page.url().includes("/portal/login") ? "pass" : "fail",
      detail: "Portal login page loads (customer session not exercised in EC-4).",
      criticality: "high",
    })

    checks.push({
      id: "browser_portal_invoice_quote_pages",
      category: "portal",
      status: "skipped",
      detail:
        "Portal invoice/quote detail pages require customer portal session — not exercised without PORTAL cert storage state.",
      criticality: "medium",
    })

    checks.push({
      id: "browser_no_payments_or_emails",
      category: "payments",
      status: "pass",
      detail: "Browser cert did not submit payments or send emails.",
      criticality: "critical",
    })
  } finally {
    await browser.close()
  }

  checks.unshift({
    id: "browser_auth_storage_state",
    category: "authentication",
    status: "pass",
    detail: `Playwright storage state loaded from ${storageState}.`,
    criticality: "high",
  })

  const ok = !checks.some(
    (c) => c.status === "fail" && (c.criticality === "critical" || c.criticality === "high"),
  )

  return {
    qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
    mode: "browser-revenue",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    storage_state: storageState,
    checks,
    fixtures,
    ok,
    executed_at,
  }
}
