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
  { name: "blitzpay_payroll_runs", select: "id, organization_id, payroll_status" },
  { name: "blitzpay_technician_compensation_profiles", select: "id, organization_id, technician_user_id" },
  { name: "blitzpay_work_order_commissions", select: "id, organization_id, commission_status" },
  { name: "blitzpay_contractor_settlements", select: "id, organization_id, settlement_status" },
  { name: "blitzpay_revenue_share_rules", select: "id, organization_id, rule_type" },
  { name: "blitzpay_revenue_share_ledger", select: "id, organization_id, idempotency_key" },
  { name: "blitzpay_cash_accounts", select: "id, organization_id, account_type" },
  { name: "blitzpay_cash_account_allocations", select: "id, organization_id, cash_account_id" },
  { name: "blitzpay_cash_reserve_rules", select: "id, organization_id, rule_type" },
  { name: "blitzpay_cash_runway_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_customer_billing_profiles", select: "id, organization_id, customer_id" },
  { name: "blitzpay_customer_payment_methods", select: "id, organization_id, customer_id" },
  { name: "blitzpay_autopay_enrollments", select: "id, organization_id, customer_id" },
  { name: "blitzpay_invoice_collection_states", select: "id, organization_id, invoice_id" },
  { name: "blitzpay_collection_attempts", select: "id, organization_id, invoice_id" },
  { name: "blitzpay_collection_recovery_flows", select: "id, organization_id, flow_status" },
  { name: "blitzpay_collection_activity_log", select: "id, organization_id, activity_type" },
  { name: "blitzpay_chart_of_accounts", select: "id, organization_id, account_code" },
  { name: "blitzpay_journal_batches", select: "id, organization_id, status" },
  { name: "blitzpay_journal_entries", select: "id, organization_id, batch_id" },
  { name: "blitzpay_journal_lines", select: "id, organization_id, journal_entry_id" },
  { name: "blitzpay_financial_periods", select: "id, organization_id, status" },
  { name: "blitzpay_deferred_revenue_schedules", select: "id, organization_id, status" },
  { name: "blitzpay_account_balances", select: "id, organization_id, account_id" },
  { name: "blitzpay_vendors", select: "id, organization_id, vendor_status" },
  { name: "blitzpay_vendor_bills", select: "id, organization_id, bill_status" },
  { name: "blitzpay_vendor_bill_lines", select: "id, organization_id, vendor_bill_id" },
  { name: "blitzpay_ap_payment_runs", select: "id, organization_id, run_status" },
  { name: "blitzpay_ap_payment_allocations", select: "id, organization_id, vendor_bill_id" },
  { name: "blitzpay_ap_approval_flows", select: "id, organization_id, approval_status" },
  { name: "blitzpay_vendor_aging_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_ap_audit_events", select: "id, organization_id, action" },
  { name: "blitzpay_tax_jurisdictions", select: "id, organization_id, tax_status" },
  { name: "blitzpay_tax_rules", select: "id, organization_id, compliance_status" },
  { name: "blitzpay_tax_calculations", select: "id, organization_id, calculation_status" },
  { name: "blitzpay_compliance_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_ach_authorizations", select: "id, organization_id, authorization_status" },
  { name: "blitzpay_vendor_tax_profiles", select: "id, organization_id, vendor_id" },
  { name: "blitzpay_tax_liability_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_marketplace_financing_providers", select: "id, organization_id, provider_status" },
  { name: "blitzpay_financing_applications", select: "id, organization_id, application_status" },
  { name: "blitzpay_financing_application_offers", select: "id, organization_id, offer_status" },
  { name: "blitzpay_contractor_advance_models", select: "id, organization_id, model_status" },
  { name: "blitzpay_financing_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_financing_provider_matches", select: "id, organization_id, match_status" },
  { name: "blitzpay_inventory_financial_items", select: "id, organization_id, item_status" },
  { name: "blitzpay_inventory_financial_movements", select: "id, organization_id, movement_type" },
  { name: "blitzpay_inventory_valuation_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_vendor_rebate_programs", select: "id, organization_id, rebate_status" },
  { name: "blitzpay_vendor_rebate_accruals", select: "id, organization_id, accrual_status" },
  { name: "blitzpay_reorder_forecasts", select: "id, organization_id, forecast_status" },
  { name: "blitzpay_serialized_asset_financials", select: "id, organization_id, asset_status" },
  { name: "blitzpay_procurement_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_ai_financial_insights", select: "id, organization_id, insight_type" },
  { name: "blitzpay_ai_recommendation_actions", select: "id, organization_id, action_status" },
  { name: "blitzpay_ai_forecast_snapshots", select: "id, organization_id, snapshot_type" },
  { name: "blitzpay_ai_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_revenue_optimization_opportunities", select: "id, organization_id, opportunity_type" },
  { name: "blitzpay_revenue_optimization_actions", select: "id, organization_id, action_status" },
  { name: "blitzpay_revenue_optimization_experiments", select: "id, organization_id, experiment_status" },
  { name: "blitzpay_customer_payment_behavior_scores", select: "id, organization_id, customer_id" },
  { name: "blitzpay_revenue_optimization_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_financial_groups", select: "id, organization_id, group_status" },
  { name: "blitzpay_financial_group_members", select: "id, financial_group_id, organization_id" },
  { name: "blitzpay_intercompany_balances", select: "id, financial_group_id, balance_status" },
  { name: "blitzpay_consolidated_snapshots", select: "id, financial_group_id, snapshot_date" },
  { name: "blitzpay_multi_entity_audit_log", select: "id, audit_type, created_at" },
  { name: "blitzpay_shared_operational_benchmarks", select: "id, financial_group_id, benchmark_type" },
  { name: "blitzpay_supplier_networks", select: "id, organization_id, network_status" },
  { name: "blitzpay_supplier_network_members", select: "id, supplier_network_id, organization_id" },
  { name: "blitzpay_preferred_vendor_programs", select: "id, vendor_id, program_status" },
  { name: "blitzpay_bulk_purchase_opportunities", select: "id, supplier_network_id, opportunity_status" },
  { name: "blitzpay_supplier_performance_scores", select: "id, organization_id, vendor_id" },
  { name: "blitzpay_vendor_financing_network_offers", select: "id, offer_status" },
  { name: "blitzpay_supplier_network_audit_log", select: "id, audit_type, created_at" },
  { name: "blitzpay_shared_procurement_benchmarks", select: "id, supplier_network_id, benchmark_type" },
  { name: "blitzpay_warranty_reserves", select: "id, organization_id, reserve_status" },
  { name: "blitzpay_claims", select: "id, organization_id, claim_status" },
  { name: "blitzpay_claim_reserve_movements", select: "id, organization_id, movement_type" },
  { name: "blitzpay_equipment_protection_plans", select: "id, organization_id, plan_status" },
  { name: "blitzpay_claims_payout_tracking", select: "id, organization_id, payout_status" },
  { name: "blitzpay_storm_event_financials", select: "id, organization_id, event_status" },
  { name: "blitzpay_claims_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_protection_plan_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_mobile_financial_intents", select: "id, organization_id, intent_status" },
  { name: "blitzpay_mobile_signature_authorizations", select: "id, organization_id, authorization_status" },
  { name: "blitzpay_mobile_payroll_approval_items", select: "id, organization_id, approval_status" },
  { name: "blitzpay_mobile_treasury_snapshots", select: "id, organization_id, snapshot_date" },
  { name: "blitzpay_mobile_sync_batches", select: "id, organization_id, batch_status" },
  { name: "blitzpay_mobile_audit_log", select: "id, organization_id, audit_type" },
  { name: "blitzpay_financial_events", select: "id, organization_id, event_type" },
  { name: "blitzpay_workflow_executions", select: "id, organization_id, workflow_type" },
  { name: "blitzpay_queue_health_snapshots", select: "id, snapshot_scope" },
  { name: "blitzpay_idempotency_records", select: "id, organization_id, idempotency_key" },
  { name: "blitzpay_observability_audit_log", select: "id, audit_type, created_at" },
  { name: "blitzpay_multi_region_sync_state", select: "id, region_name, sync_status" },
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
