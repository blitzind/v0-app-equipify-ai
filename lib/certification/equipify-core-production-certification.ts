/**
 * Equipify Core production certification execution (EC-2).
 * Readiness + read-safe modes only — no mutations, payments, or email sends.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"
import { getBillingAccessState } from "@/lib/billing/access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { isStripeLiveEnforced } from "@/lib/billing/stripe-env"
import { stripePriceIdForPlan } from "@/lib/billing/stripe-price-map"
import {
  getEffectiveBillingStatus,
  getOrganizationSubscription,
  isTrialActive,
} from "@/lib/billing/subscriptions"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import { getOutboundEmailHealth } from "@/lib/email/config"
import { getPlan, PLAN_IDS, type PlanId } from "@/lib/plans"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { EQUIPIFY_CORE_PRODUCTION_HOST } from "@/lib/certification/equipify-core-runtime-inventory"

export const EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER = "equipify-core-certification-ec-2-v1" as const

export const EQUIPIFY_CORE_PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

export type EquipifyCoreCertMode =
  | "readiness"
  | "read-safe"
  | "mutation-dry-run"
  | "payment-dry-run"

export type EnvPresenceStatus = "present" | "missing" | "optional_missing" | "disabled_by_flag"

export type CertCheckResult = {
  id: string
  category: string
  status: "pass" | "fail" | "blocked" | "skipped"
  detail: string
  criticality: "critical" | "high" | "medium" | "low"
}

export type ReadinessReport = {
  qa_marker: typeof EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER
  mode: "readiness"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  vercel_production_env_run: boolean
  /** True when Vercel CLI run cannot materialize Sensitive secrets in the local child process. */
  local_sensitive_secrets_materialized: boolean
  checks: CertCheckResult[]
  env: Record<string, EnvPresenceStatus>
  ok: boolean
  executed_at: string
}

export type ReadSafeReport = {
  qa_marker: typeof EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER
  mode: "read-safe"
  production_host: typeof EQUIPIFY_CORE_PRODUCTION_HOST
  organization_id: string | null
  organization_source: string | null
  supabase_credential_source: string | null
  checks: CertCheckResult[]
  billing: {
    plan_id: string | null
    intended_plan_id: string | null
    effective_plan_id: string | null
    catalog_plan_name: string | null
    branded_plan_display_candidate: string | null
    subscription_status: string | null
    effective_billing_status: string | null
    billing_access_level: string | null
    allow_record_creation: boolean | null
    trial_active: boolean | null
  } | null
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

function stripeKeyModeLabel(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  if (!key) return "missing"
  if (key.startsWith("sk_live_")) return "present_live"
  if (key.startsWith("sk_test_")) return "present_test"
  return "present_invalid_prefix"
}

function resolveStripePricePresence(planId: PlanId, cycle: "monthly" | "annual"): EnvPresenceStatus {
  try {
    const priceId = stripePriceIdForPlan(planId, cycle)
    if (!priceId?.startsWith("price_")) return "missing"
    return "present"
  } catch {
    return "missing"
  }
}

function brandedPlanDisplayCandidate(planId: string): string {
  const plan = getPlan(planId)
  return `Equipify ${plan.name}`
}

export function runEquipifyCoreReadinessChecks(): ReadinessReport {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []
  const env: Record<string, EnvPresenceStatus> = {}

  const setEnv = (key: string, optional = false) => {
    env[key] = envPresence(key, optional)
  }

  // Core platform
  setEnv("NEXT_PUBLIC_SUPABASE_URL")
  setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  setEnv("SUPABASE_SERVICE_ROLE_KEY")
  env.VERCEL_PRODUCTION_RUNTIME =
    process.env.VERCEL_ENV === "production" || process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"
      ? "present"
      : "missing"

  // Email
  setEnv("RESEND_API_KEY")
  const emailHealth = getOutboundEmailHealth()
  env.EMAIL_FROM_ADDRESS = emailHealth.hasFromAddress ? "present" : "optional_missing"

  // SaaS billing
  setEnv("STRIPE_SECRET_KEY")
  setEnv("STRIPE_WEBHOOK_SECRET")
  setEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", true)

  const stripeMode = stripeKeyModeLabel()
  if (stripeMode === "present_live" || stripeMode === "present_test") {
    env.STRIPE_SECRET_KEY_MODE = "present"
    if (isStripeLiveEnforced() && stripeMode === "present_test") {
      checks.push({
        id: "stripe_live_mode_mismatch",
        category: "billing",
        status: "fail",
        detail: "VERCEL_ENV=production but STRIPE_SECRET_KEY is test mode (sk_test_).",
        criticality: "critical",
      })
    } else {
      checks.push({
        id: "stripe_secret_key_mode",
        category: "billing",
        status: "pass",
        detail: isStripeLiveEnforced()
          ? "Live Stripe key shape verified (sk_live_ prefix)."
          : `Stripe key present (${stripeMode === "present_live" ? "live" : "test"}).`,
        criticality: "critical",
      })
    }
  } else {
    env.STRIPE_SECRET_KEY_MODE = "missing"
    checks.push({
      id: "stripe_secret_key_mode",
      category: "billing",
      status: "fail",
      detail: "STRIPE_SECRET_KEY missing or invalid prefix.",
      criticality: "critical",
    })
  }

  for (const planId of PLAN_IDS) {
    for (const cycle of ["monthly", "annual"] as const) {
      const envKey = `STRIPE_PRICE_${planId.toUpperCase()}_${cycle === "monthly" ? "MONTHLY" : "ANNUAL"}`
      const fromEnv = envPresence(envKey, true)
      const resolved = resolveStripePricePresence(planId, cycle)
      env[envKey] = fromEnv === "present" ? "present" : resolved
    }
  }

  // BlitzPay
  setEnv("STRIPE_BLITZPAY_WEBHOOK_SECRET")
  env.BLITZPAY_INVOICE_PAY_ENABLED = isBlitzPayInvoicePayEnabledEnv() ? "present" : "disabled_by_flag"
  env.STRIPE_CONNECT_VIA_SECRET_KEY = env.STRIPE_SECRET_KEY

  // Portal (inherits supabase + resend)
  env.PORTAL_SESSION_DEPENDENCIES =
    env.NEXT_PUBLIC_SUPABASE_URL === "present" && env.SUPABASE_SERVICE_ROLE_KEY === "present"
      ? "present"
      : "missing"
  env.PORTAL_EMAIL_DEPENDENCIES = emailHealth.configured ? "present" : "optional_missing"

  // Optional integrations
  setEnv("QUICKBOOKS_CLIENT_ID", true)
  setEnv("QUICKBOOKS_CLIENT_SECRET", true)
  setEnv("QUICKBOOKS_REDIRECT_URI", true)
  setEnv("INTEGRATION_OAUTH_STATE_SECRET", true)
  setEnv("TWILIO_ACCOUNT_SID", true)
  setEnv("TWILIO_AUTH_TOKEN", true)
  setEnv("TELNYX_API_KEY", true)

  const criticalKeys: Array<{ key: string; category: string; label: string }> = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", category: "platform", label: "Supabase URL" },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", category: "platform", label: "Supabase anon key" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", category: "platform", label: "Supabase service role" },
    { key: "RESEND_API_KEY", category: "email", label: "Resend API key" },
    { key: "STRIPE_SECRET_KEY", category: "billing", label: "Stripe secret key" },
    { key: "STRIPE_WEBHOOK_SECRET", category: "billing", label: "Stripe SaaS webhook secret" },
    { key: "STRIPE_BLITZPAY_WEBHOOK_SECRET", category: "payments", label: "BlitzPay webhook secret" },
  ]

  for (const { key, category, label } of criticalKeys) {
    const status = env[key]
    checks.push({
      id: `env_${key.toLowerCase()}`,
      category,
      status: status === "present" ? "pass" : "fail",
      detail: `${label}: ${status}`,
      criticality: "critical",
    })
  }

  checks.push({
    id: "env_vercel_production_runtime",
    category: "platform",
    status: env.VERCEL_PRODUCTION_RUNTIME === "present" ? "pass" : "fail",
    detail:
      env.VERCEL_PRODUCTION_RUNTIME === "present"
        ? "Vercel production runtime confirmed (VERCEL_ENV=production or EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN=1)."
        : "Not running under Vercel production env injection.",
    criticality: "high",
  })

  checks.push({
    id: "env_email_from_address",
    category: "email",
    status: emailHealth.hasFromAddress ? "pass" : "fail",
    detail: emailHealth.hasFromAddress
      ? "EMAIL_FROM_ADDRESS (or EMAIL_FROM) present."
      : "Sender from-address missing — outbound email blocked.",
    criticality: "critical",
  })

  checks.push({
    id: "env_blitzpay_invoice_pay_flag",
    category: "payments",
    status: "pass",
    detail: isBlitzPayInvoicePayEnabledEnv()
      ? "BLITZPAY_INVOICE_PAY_ENABLED=true (invoice pay APIs enabled)."
      : "BLITZPAY_INVOICE_PAY_ENABLED not true — invoice pay gated (expected until payment cert).",
    criticality: "high",
  })

  for (const planId of PLAN_IDS) {
    const monthly = resolveStripePricePresence(planId, "monthly")
    const annual = resolveStripePricePresence(planId, "annual")
    checks.push({
      id: `stripe_price_${planId}`,
      category: "billing",
      status: monthly === "present" && annual === "present" ? "pass" : "fail",
      detail: `Stripe price IDs for ${planId}: monthly=${monthly}, annual=${annual}`,
      criticality: "critical",
    })
  }

  const ok = !checks.some(
    (c) => c.status === "fail" && (c.criticality === "critical" || c.criticality === "high"),
  )

  const sensitivePresent = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
  ].every((key) => env[key] === "present")

  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1" && !sensitivePresent) {
    checks.push({
      id: "local_vercel_sensitive_secret_materialization",
      category: "platform",
      status: "blocked",
      detail:
        "Vercel `env run` did not materialize Sensitive secrets locally; runtime on Vercel Production may still be configured. Use Supabase CLI linked project for read-safe DB checks.",
      criticality: "high",
    })
  }

  return {
    qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
    mode: "readiness",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    vercel_production_env_run: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
    local_sensitive_secrets_materialized: sensitivePresent,
    checks,
    env,
    ok,
    executed_at,
  }
}

async function fetchProductionRoute(
  path: string,
  options?: { expectStatuses?: number[]; timeoutMs?: number },
): Promise<{ ok: boolean; status: number; durationMs: number; error?: string }> {
  const url = `${EQUIPIFY_CORE_PRODUCTION_HOST}${path}`
  const timeoutMs = options?.timeoutMs ?? 20_000
  const started = Date.now()
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "text/html,application/json" },
    })
    const durationMs = Date.now() - started
    const expect = options?.expectStatuses ?? [200, 301, 302, 307, 308]
    return { ok: expect.includes(response.status), status: response.status, durationMs }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function detectWorkOrdersUnboundedClientLoad(): { unbounded: boolean; detail: string; limit: number | null } {
  const filePath = resolve(process.cwd(), "app/(dashboard)/work-orders/page.tsx")
  const limitModulePath = resolve(process.cwd(), "lib/work-orders/work-orders-list-limit.ts")
  if (!existsSync(filePath)) {
    return { unbounded: true, detail: "work-orders page source not found", limit: null }
  }
  const source = readFileSync(filePath, "utf8")
  const limitSource = existsSync(limitModulePath) ? readFileSync(limitModulePath, "utf8") : ""
  const limitMatch = limitSource.match(/WORK_ORDERS_LIST_PAGE_LIMIT\s*=\s*(\d+)/)
  const parsedLimit = limitMatch ? Number.parseInt(limitMatch[1]!, 10) : null

  const queryBlock = source.includes('.from("work_orders")')
  const usesListLimitConstant = source.includes("WORK_ORDERS_LIST_PAGE_LIMIT")
  const hasLimitOnQuery =
    /runWorkOrdersQuery[\s\S]{0,800}\.limit\(\s*WORK_ORDERS_LIST_PAGE_LIMIT\s*\)/m.test(source) ||
    /from\("work_orders"\)[\s\S]{0,400}\.limit\(/m.test(source)

  if (queryBlock && usesListLimitConstant && hasLimitOnQuery && parsedLimit != null && parsedLimit > 0) {
    return {
      unbounded: false,
      detail: `Client work_orders list query bounded with .limit(${parsedLimit}) via WORK_ORDERS_LIST_PAGE_LIMIT.`,
      limit: parsedLimit,
    }
  }

  if (queryBlock && !hasLimitOnQuery) {
    return {
      unbounded: true,
      detail: "Client work_orders list query has no .limit() — full-org hydration risk remains.",
      limit: null,
    }
  }

  return {
    unbounded: false,
    detail: hasLimitOnQuery
      ? "work_orders list query includes .limit()."
      : "work_orders query pattern not detected in page source.",
    limit: parsedLimit,
  }
}

async function resolveCertOrganizationId(
  admin: SupabaseClient,
): Promise<{ organizationId: string; source: string } | null> {
  const fromEnv = process.env.EQUIPIFY_CORE_CERT_ORGANIZATION_ID?.trim()
  if (fromEnv) {
    const { data, error } = await admin.from("organizations").select("id").eq("id", fromEnv).maybeSingle()
    if (error || !data?.id) return null
    return { organizationId: data.id, source: "EQUIPIFY_CORE_CERT_ORGANIZATION_ID" }
  }

  const { data, error } = await admin
    .from("organization_subscriptions")
    .select("organization_id, status, updated_at")
    .in("status", ["active", "trialing"])
    .order("updated_at", { ascending: false })
    .limit(1)

  if (error || !data?.[0]?.organization_id) return null
  return { organizationId: data[0].organization_id, source: "organization_subscriptions_active_sample" }
}

async function readListSample(
  admin: SupabaseClient,
  table: string,
  organizationId: string,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const { data, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: false })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) return { ok: false, count: 0, error: error.message }
  return { ok: true, count: data?.length ?? 0 }
}

async function bootstrapEquipifyCoreReadSafeSupabase(): Promise<{
  url: string
  jwt: string
  source: string
} | null> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: EQUIPIFY_CORE_PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
  })
  if (boot) {
    return { url: boot.url, jwt: boot.jwt, source: "verified_channels_cert_env_bootstrap" }
  }

  const projectRef = resolveLinkedSupabaseProjectRef()
  if (!projectRef) return null
  const jwt = fetchSupabaseServiceRoleKeyFromCli(projectRef)
  if (!jwt) return null
  const url = resolveSupabaseUrlForProjectRef(projectRef)
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt
  return { url, jwt, source: "supabase_cli_linked_project" }
}

export async function runEquipifyCoreReadSafeChecks(): Promise<ReadSafeReport> {
  const executed_at = new Date().toISOString()
  const checks: CertCheckResult[] = []

  const boot = await bootstrapEquipifyCoreReadSafeSupabase()

  if (!boot) {
    checks.push({
      id: "supabase_bootstrap",
      category: "platform",
      status: "blocked",
      detail:
        "Supabase production credentials unavailable (Vercel sensitive secrets not materialized locally; link Supabase CLI project or set EQUIPIFY_CORE_CERT_ORGANIZATION_ID with service role).",
      criticality: "critical",
    })
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "read-safe",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: null,
      organization_source: null,
      supabase_credential_source: null,
      checks,
      billing: null,
      ok: false,
      executed_at,
    }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  checks.push({
    id: "supabase_bootstrap",
    category: "platform",
    status: "pass",
    detail: `Supabase service-role client bootstrapped (${boot.source}).`,
    criticality: "critical",
  })

  const storageStatePath =
    process.env.EQUIPIFY_CORE_CERT_STORAGE_STATE?.trim() ||
    process.env.GROWTH_CERT_STORAGE_STATE?.trim() ||
    ""
  if (storageStatePath && existsSync(resolve(process.cwd(), storageStatePath))) {
    checks.push({
      id: "auth_cert_storage_state",
      category: "authentication",
      status: "pass",
      detail: `Cert storage state file present at ${storageStatePath} (browser auth cert not executed in EC-2).`,
      criticality: "medium",
    })
  } else {
    checks.push({
      id: "auth_cert_storage_state",
      category: "authentication",
      status: "skipped",
      detail:
        "No EQUIPIFY_CORE_CERT_STORAGE_STATE — authenticated browser user not verified (read-safe DB path only).",
      criticality: "medium",
    })
  }

  const orgResolution = await resolveCertOrganizationId(admin)
  if (!orgResolution) {
    checks.push({
      id: "resolve_cert_organization",
      category: "platform",
      status: "blocked",
      detail:
        "Could not resolve cert organization (set EQUIPIFY_CORE_CERT_ORGANIZATION_ID or ensure active subscription rows exist).",
      criticality: "critical",
    })
    return {
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      mode: "read-safe",
      production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
      organization_id: null,
      organization_source: null,
      supabase_credential_source: boot.source,
      checks,
      billing: null,
      ok: false,
      executed_at,
    }
  }

  const { organizationId, source: organization_source } = orgResolution
  checks.push({
    id: "resolve_cert_organization",
    category: "platform",
    status: "pass",
    detail: `Cert organization resolved via ${organization_source}.`,
    criticality: "critical",
  })

  const subscription = await getOrganizationSubscription(admin, organizationId)
  const planId = subscription?.plan_id ?? "solo"
  const effectivePlanId = getEffectivePlanId(planId, subscription)
  const billingAccess = getBillingAccessState(subscription)
  const effectiveBilling = subscription ? getEffectiveBillingStatus(subscription) : "none"

  const billing = {
    plan_id: subscription?.plan_id ?? null,
    intended_plan_id: subscription?.intended_plan_id ?? null,
    effective_plan_id: effectivePlanId,
    catalog_plan_name: getPlan(effectivePlanId).name,
    branded_plan_display_candidate: brandedPlanDisplayCandidate(effectivePlanId),
    subscription_status: subscription?.status ?? null,
    effective_billing_status: effectiveBilling,
    billing_access_level: billingAccess.level,
    allow_record_creation: billingAccess.allowRecordCreation,
    trial_active: subscription ? isTrialActive(subscription) : null,
  }

  checks.push({
    id: "billing_subscription_row",
    category: "billing",
    status: subscription ? "pass" : "fail",
    detail: subscription
      ? `Subscription row readable (status=${subscription.status}, plan_id=${subscription.plan_id}).`
      : "No organization_subscriptions row for cert org.",
    criticality: "critical",
  })

  checks.push({
    id: "billing_plan_display_candidate",
    category: "billing",
    status: "pass",
    detail: `Branded display candidate: ${billing.branded_plan_display_candidate} (not applied in UI until EC-5).`,
    criticality: "medium",
  })

  checks.push({
    id: "billing_effective_entitlements_plan",
    category: "billing",
    status: "pass",
    detail: `Effective plan for entitlements: ${effectivePlanId}; billing access=${billingAccess.level}, allow_create=${billingAccess.allowRecordCreation}.`,
    criticality: "high",
  })

  const listTables = [
    { id: "customers_list_sample", table: "customers", category: "customers" },
    { id: "prospects_list_sample", table: "prospects", category: "prospects" },
    { id: "work_orders_list_sample", table: "work_orders", category: "work_orders" },
    { id: "org_quotes_list_sample", table: "org_quotes", category: "quotes" },
    { id: "org_invoices_list_sample", table: "org_invoices", category: "invoices" },
    { id: "purchase_orders_list_sample", table: "org_purchase_orders", category: "purchase_orders" },
  ] as const

  for (const item of listTables) {
    const sample = await readListSample(admin, item.table, organizationId)
    checks.push({
      id: item.id,
      category: item.category,
      status: sample.ok ? "pass" : "fail",
      detail: sample.ok
        ? `Read ${sample.count} row(s) with limit(5) on ${item.table}.`
        : `List read failed on ${item.table}: ${sample.error}`,
      criticality: item.table === "work_orders" || item.table === "org_invoices" ? "critical" : "high",
    })
  }

  const woRisk = detectWorkOrdersUnboundedClientLoad()
  checks.push({
    id: "work_orders_unbounded_client_risk",
    category: "work_orders",
    status: woRisk.unbounded ? "fail" : "pass",
    detail: woRisk.detail,
    criticality: "high",
  })

  const routeChecks: Array<{
    id: string
    path: string
    category: string
    expectStatuses: number[]
    criticality: CertCheckResult["criticality"]
  }> = [
    { id: "route_login", path: "/login", category: "authentication", expectStatuses: [200], criticality: "critical" },
    {
      id: "route_portal_login",
      path: "/portal/login",
      category: "portal",
      expectStatuses: [200],
      criticality: "critical",
    },
    {
      id: "route_portal_bootstrap_auth",
      path: "/api/portal/bootstrap",
      category: "portal",
      expectStatuses: [401, 403],
      criticality: "high",
    },
    {
      id: "route_billing_auth_redirect",
      path: "/settings/billing",
      category: "billing",
      expectStatuses: [307, 308, 302, 301],
      criticality: "high",
    },
    { id: "route_dashboard", path: "/", category: "settings", expectStatuses: [307, 308, 302, 301, 200], criticality: "high" },
  ]

  for (const route of routeChecks) {
    const result = await fetchProductionRoute(route.path, { expectStatuses: route.expectStatuses })
    checks.push({
      id: route.id,
      category: route.category,
      status: result.ok ? "pass" : "fail",
      detail: result.ok
        ? `GET ${route.path} → HTTP ${result.status} (${result.durationMs}ms).`
        : `GET ${route.path} failed: status=${result.status}${result.error ? `, ${result.error}` : ""}`,
      criticality: route.criticality,
    })
  }

  const pdfRouteFiles = [
    {
      id: "pdf_route_quote",
      category: "quotes",
      relativePath: "app/api/organizations/[organizationId]/quotes/[quoteId]/pdf/route.ts",
    },
    {
      id: "pdf_route_invoice",
      category: "invoices",
      relativePath: "app/api/organizations/[organizationId]/invoices/[invoiceId]/pdf/route.ts",
    },
    {
      id: "pdf_route_purchase_order",
      category: "purchase_orders",
      relativePath:
        "app/api/organizations/[organizationId]/purchase-orders/[purchaseOrderId]/pdf/route.ts",
    },
  ] as const

  for (const pdf of pdfRouteFiles) {
    const exists = existsSync(resolve(process.cwd(), pdf.relativePath))
    checks.push({
      id: pdf.id,
      category: pdf.category,
      status: exists ? "pass" : "fail",
      detail: exists
        ? `PDF API route file present (${pdf.relativePath}).`
        : `PDF route file missing: ${pdf.relativePath}`,
      criticality: "medium",
    })
  }

  checks.push({
    id: "billing_no_checkout_mutation",
    category: "billing",
    status: "pass",
    detail: "Read-safe mode did not call /api/billing/checkout or Stripe APIs.",
    criticality: "critical",
  })

  const ok = !checks.some((c) => c.status === "fail" && (c.criticality === "critical" || c.criticality === "high"))

  return {
    qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
    mode: "read-safe",
    production_host: EQUIPIFY_CORE_PRODUCTION_HOST,
    organization_id: organizationId,
    organization_source,
    supabase_credential_source: boot.source,
    checks,
    billing,
    ok,
    executed_at,
  }
}

export function unsupportedModeReport(mode: EquipifyCoreCertMode): { ok: false; mode: EquipifyCoreCertMode; detail: string } {
  return {
    ok: false,
    mode,
    detail: `${mode} is not implemented in EC-2. Use --mode=readiness or --mode=read-safe.`,
  }
}
