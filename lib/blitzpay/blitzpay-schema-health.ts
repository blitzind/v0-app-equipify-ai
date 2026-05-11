import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE,
  looksLikePostgrestMissingSchemaError,
} from "@/lib/blitzpay/blitzpay-schema-health-detect"

export { BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE, looksLikePostgrestMissingSchemaError }

const ORG_BLITZPAY_DIAGNOSTIC_COLUMNS = [
  "blitzpay_last_onboarding_attempt_at",
  "blitzpay_last_onboarding_failure_at",
  "blitzpay_last_onboarding_error_category",
  "blitzpay_last_stripe_request_id",
] as const

const CRITICAL_BLITZPAY_TABLES: ReadonlyArray<{ name: string; select: string }> = [
  { name: "blitzpay_org_settings", select: "organization_id" },
  { name: "blitzpay_payment_intents", select: "id, org_invoice_id, org_quote_id" },
  { name: "blitzpay_invoice_payment_attempts", select: "id" },
  { name: "blitzpay_fee_snapshots", select: "id" },
  { name: "blitzpay_invoice_refunds", select: "id" },
  { name: "blitzpay_invoice_disputes", select: "id" },
  { name: "blitzpay_webhook_inbox", select: "stripe_event_id" },
  { name: "blitzpay_payouts", select: "id" },
  { name: "blitzpay_balance_transactions", select: "id" },
  { name: "blitzpay_reconciliation_runs", select: "id" },
  { name: "blitzpay_customer_payment_profiles", select: "id" },
  { name: "blitzpay_payment_links", select: "id, org_invoice_id, org_quote_id" },
  { name: "blitzpay_payment_reminders", select: "id" },
  { name: "blitzpay_reminder_runs", select: "id" },
  { name: "blitzpay_recovery_cases", select: "id" },
  { name: "blitzpay_collections_timeline", select: "id" },
  { name: "blitzpay_scheduled_invoice_payments", select: "id" },
  { name: "blitzpay_autopay_consent_events", select: "id" },
  { name: "blitzpay_customer_wallets", select: "id, organization_id, customer_id" },
  { name: "blitzpay_customer_wallet_ledger", select: "id, entry_kind, idempotency_key" },
  { name: "blitzpay_financing_providers", select: "code, display_name" },
  { name: "blitzpay_org_financing_providers", select: "organization_id, provider_code" },
  { name: "blitzpay_financing_sessions", select: "id, status" },
  { name: "blitzpay_financing_offers", select: "id, session_id" },
  { name: "blitzpay_org_balances", select: "organization_id" },
  { name: "blitzpay_balance_snapshots", select: "id" },
  { name: "blitzpay_payment_plans", select: "id, organization_id" },
  { name: "blitzpay_payment_plan_installments", select: "id, payment_plan_id" },
  { name: "blitzpay_vendor_payables", select: "id, organization_id, status" },
  { name: "blitzpay_vendor_payouts", select: "id, organization_id, vendor_payable_id" },
  { name: "blitzpay_memberships", select: "id, organization_id, status" },
  { name: "blitzpay_membership_invoices", select: "id, membership_id, org_invoice_id" },
  { name: "blitzpay_membership_payment_failures", select: "id, membership_id, recovery_status" },
  { name: "blitzpay_membership_events", select: "id, membership_id, event_type" },
  { name: "blitzpay_membership_retention_snapshots", select: "id, organization_id, snapshot_date" },
]

export type BlitzpaySchemaHealthResult =
  | { ok: true }
  | { ok: false; kind: "schema_incomplete"; missing: string; detail: string }
  | { ok: false; kind: "check_failed"; detail: string; code?: string }

let cache: { expiresAt: number; result: BlitzpaySchemaHealthResult } | null = null
const CACHE_MS = 60_000

function describeOrgColumnGap(message: string): string {
  const quoted = message.match(/column\s+"([^"]+)"/i)
  if (quoted?.[1]) return `organizations.${quoted[1]}`
  const bare = message.match(/column\s+(\S+)\s+does not exist/i)
  if (bare?.[1]) return `organizations.${bare[1].replace(/[,;]+$/, "")}`
  return `organizations.${ORG_BLITZPAY_DIAGNOSTIC_COLUMNS.join(",")}`
}

/**
 * Probes PostgREST for BlitzPay-critical tables and onboarding diagnostic columns.
 * Use a **service role** client so inbox and RLS do not mask missing tables as permission errors.
 */
export async function runBlitzpaySchemaHealthCheck(admin: SupabaseClient): Promise<BlitzpaySchemaHealthResult> {
  const orgSelect = ["id", ...ORG_BLITZPAY_DIAGNOSTIC_COLUMNS].join(", ")
  const { error: orgErr } = await admin.from("organizations").select(orgSelect).limit(1)
  if (orgErr) {
    const msg = orgErr.message ?? String(orgErr)
    if (looksLikePostgrestMissingSchemaError(msg, orgErr.code)) {
      const missing = msg.toLowerCase().includes("column") ? describeOrgColumnGap(msg) : "organizations(blitzpay_columns)"
      return { ok: false, kind: "schema_incomplete", missing, detail: msg }
    }
    return { ok: false, kind: "check_failed", detail: msg, code: orgErr.code }
  }

  for (const t of CRITICAL_BLITZPAY_TABLES) {
    const { error } = await admin.from(t.name).select(t.select).limit(1)
    if (error) {
      const msg = error.message ?? String(error)
      if (looksLikePostgrestMissingSchemaError(msg, error.code)) {
        return { ok: false, kind: "schema_incomplete", missing: `table:${t.name}`, detail: msg }
      }
      return { ok: false, kind: "check_failed", detail: `${t.name}: ${msg}`, code: error.code }
    }
  }

  return { ok: true }
}

export function logBlitzpaySchemaDrift(missing: string, detail: string, context?: string): void {
  try {
    console.warn(
      JSON.stringify({
        source: "blitzpay-schema-health",
        message: "schema_incomplete",
        missing,
        detail: detail.slice(0, 500),
        context: context ?? null,
        fix: "Apply pending Supabase migrations to this environment's database project (see docs/BLITZPAY_PHASE_2_ARCHITECTURE.md — schema health).",
      }),
    )
  } catch {
    /* best-effort */
  }
}

export function blitzpaySchemaDriftNextResponse(missing: string): NextResponse {
  return NextResponse.json(
    {
      error: "blitzpay_schema_incomplete",
      message: BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE,
      missing,
    },
    { status: 503 },
  )
}

/** Cached result to avoid hammering PostgREST on every poll. */
export async function runBlitzpaySchemaHealthCheckCached(admin: SupabaseClient): Promise<BlitzpaySchemaHealthResult> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.result
  }
  const result = await runBlitzpaySchemaHealthCheck(admin)
  cache = { expiresAt: now + CACHE_MS, result }
  return result
}

export function invalidateBlitzpaySchemaHealthCache(): void {
  cache = null
}

/** Uses an existing service-role client (no second connection). */
export async function blitzpaySchemaDriftIfUnhealthy(
  admin: SupabaseClient,
  context: string,
): Promise<NextResponse | null> {
  const r = await runBlitzpaySchemaHealthCheckCached(admin)
  if (r.ok) return null
  if (r.kind === "schema_incomplete") {
    logBlitzpaySchemaDrift(r.missing, r.detail, context)
    return blitzpaySchemaDriftNextResponse(r.missing)
  }
  return null
}

/**
 * When the service role is available, returns a 503 JSON response if BlitzPay migrations are missing.
 * Returns null when the check cannot run (no service role) or when the failure is not a schema gap
 * (caller should proceed and surface real errors).
 */
export async function blitzpaySchemaGuardNextResponse(context: string): Promise<NextResponse | null> {
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return null
  }
  return blitzpaySchemaDriftIfUnhealthy(admin, context)
}
