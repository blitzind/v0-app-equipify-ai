import type { SupabaseClient } from "@supabase/supabase-js"
import { computeInvoicePaymentAllocation, invoiceGrandTotalCents } from "@/lib/billing/invoice-payment-allocation"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

/**
 * Subscription states that block hard-delete when a real Stripe subscription id exists.
 * `trialing` is intentionally excluded so trial workspaces can be removed without Stripe churn.
 */
const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
])

/** Issued / receivable statuses (lowercase DB). Draft/paid/void never block on their own. */
const INVOICE_STATUSES_FOR_BALANCE_CHECK = new Set(["sent", "unpaid", "overdue"])

/**
 * Known internal demo / idempotent seed invoice `seed_key` prefixes only.
 * QuickBooks historical imports use `${uuid}-qb-…` and must never match these literals.
 */
const INTERNAL_DEMO_INVOICE_SEED_KEY_PREFIXES = ["pbs-seed-inv-", "demo-import-inv-"] as const

/** Issued by `executeDemoSeed` only (`lib/demo-seeding/seed-demo-content.ts`). */
const DEMO_ONBOARDING_INVOICE_NUMBER_RE = /^I-DEMO-\d{4}$/i

export type OrgInvoiceDemoClassificationRow = {
  is_sample?: boolean | null
  seed_key?: string | null
  invoice_number?: string | null
}

type OrgInvoiceBalanceRow = OrgInvoiceDemoClassificationRow & {
  id: string
  status: string
  amount_cents: number | null
  tax_amount_cents: number | null
  customer_id: string | null
}

/**
 * Demo / sample invoices are not treated as open AR for platform hard-delete.
 * Prefer explicit `is_sample`, then internal `seed_key` prefixes, then deterministic onboarding invoice numbers.
 * QuickBooks historical imports use `${uuid}-qb-…` and are never matched here.
 */
export function isOrgInvoiceDemoOrSampleForDeleteGuard(row: OrgInvoiceDemoClassificationRow): boolean {
  if (row.is_sample === true) return true
  const sk = String(row.seed_key ?? "").trim().toLowerCase()
  if (INTERNAL_DEMO_INVOICE_SEED_KEY_PREFIXES.some((p) => sk.startsWith(p))) return true
  const invNo = String(row.invoice_number ?? "").trim()
  if (DEMO_ONBOARDING_INVOICE_NUMBER_RE.test(invNo)) return true
  return false
}

function netPaymentsCents(
  payments: Array<{ invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const p of payments) {
    if (p.invoice_id !== invoiceId) continue
    sum += Math.round(Number(p.amount_cents) || 0)
  }
  return sum
}

function netRefundsCents(
  refunds: Array<{ org_invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const r of refunds) {
    if (r.org_invoice_id !== invoiceId) continue
    sum += Math.round(Number(r.amount_cents) || 0)
  }
  return sum
}

export function orgInvoiceBalanceDueSnapshot(
  row: OrgInvoiceBalanceRow,
  paymentsTotalCents: number,
): { hasOpenBalanceCheck: boolean; balanceDueCents: number; invoiceTotalCents: number } {
  const st = String(row.status || "").toLowerCase()
  if (!INVOICE_STATUSES_FOR_BALANCE_CHECK.has(st)) {
    return { hasOpenBalanceCheck: false, balanceDueCents: 0, invoiceTotalCents: 0 }
  }

  const invoiceTotalCents = invoiceGrandTotalCents({
    amount_cents: Math.round(Number(row.amount_cents) || 0),
    tax_amount_cents: row.tax_amount_cents,
  })
  if (invoiceTotalCents <= 0) {
    return { hasOpenBalanceCheck: false, balanceDueCents: 0, invoiceTotalCents: 0 }
  }

  const { balanceDueCents } = computeInvoicePaymentAllocation({
    invoiceTotalCents,
    paymentsTotalCents,
    dbInvoiceStatus: st,
  })

  return { hasOpenBalanceCheck: true, balanceDueCents, invoiceTotalCents }
}

/**
 * True when this invoice still has a customer balance to collect (matches AR semantics).
 */
export function orgInvoiceBlocksOrganizationDelete(row: OrgInvoiceBalanceRow, paymentsTotalCents: number): boolean {
  const snap = orgInvoiceBalanceDueSnapshot(row, paymentsTotalCents)
  return snap.hasOpenBalanceCheck && snap.balanceDueCents > 0
}

export function subscriptionBlocksOrganizationDelete(subscription: {
  stripe_subscription_id: string | null | undefined
  status: string | null | undefined
} | null): boolean {
  if (!subscription) return false
  const stripeSub = normalizeStripeIdColumn(subscription.stripe_subscription_id ?? null)
  if (!stripeSub) return false
  const st = String(subscription.status || "").toLowerCase()
  if (st === "trialing") return false
  return BLOCKING_SUBSCRIPTION_STATUSES.has(st)
}

export type OrganizationDeleteInvoiceBlockDetails = {
  /** Invoices with balance due that were ignored because they are demo/sample by policy. */
  excludedDemoSampleInvoicesWithBalanceDueCount: number
  blockingRealInvoiceCount: number
  blockingInvoices: Array<{
    id: string
    invoiceNumber: string | null
    status: string
    totalCents: number
    balanceDueCents: number
    isSample: boolean
    seedKey: string | null
    customerId: string | null
    customerLabel: string | null
    customerIsSample: boolean | null
  }>
}

export type OrganizationDeleteGuardResult =
  | { ok: true }
  | { ok: false; httpStatus: 409; error: "active_subscription"; message: string }
  | {
      ok: false
      httpStatus: 409
      error: "unpaid_invoices"
      message: string
      details: OrganizationDeleteInvoiceBlockDetails
    }
  | { ok: false; httpStatus: 500; error: string; message: string }

/**
 * Platform-admin hard delete preflight: paid Stripe states and open AR only.
 * Demo/sample invoices (`is_sample`, internal demo `seed_key` prefixes, or `I-DEMO-####` onboarding numbers) do not block delete.
 */
export async function evaluateOrganizationDeleteGuards(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationDeleteGuardResult> {
  const { data: sub, error: subErr } = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (subErr) {
    return { ok: false, httpStatus: 500, error: "subscription_check_failed", message: subErr.message }
  }

  if (subscriptionBlocksOrganizationDelete(sub)) {
    return {
      ok: false,
      httpStatus: 409,
      error: "active_subscription",
      message:
        "Cannot delete: this organization has a billable Stripe subscription (active, past due, unpaid, paused, or incomplete). Cancel in Stripe and sync, or wait until the subscription is trialing/canceled.",
    }
  }

  const { data: invoices, error: invErr } = await admin
    .from("org_invoices")
    .select("id, status, amount_cents, tax_amount_cents, is_sample, seed_key, customer_id, invoice_number")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  if (invErr) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: invErr.message }
  }

  const rows = (invoices ?? []) as OrgInvoiceBalanceRow[]
  const candidateIds = rows
    .filter((r) => INVOICE_STATUSES_FOR_BALANCE_CHECK.has(String(r.status || "").toLowerCase()))
    .map((r) => r.id)

  if (candidateIds.length === 0) {
    return { ok: true }
  }

  const [payRes, refundRes] = await Promise.all([
    admin
      .from("org_invoice_payments")
      .select("invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("invoice_id", candidateIds),
    admin
      .from("blitzpay_invoice_refunds")
      .select("org_invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", candidateIds)
      .eq("status", "succeeded"),
  ])

  if (payRes.error) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: payRes.error.message }
  }
  if (refundRes.error) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: refundRes.error.message }
  }

  const payments = (payRes.data ?? []) as Array<{ invoice_id: string; amount_cents: number | null }>
  const refunds = (refundRes.data ?? []) as Array<{ org_invoice_id: string; amount_cents: number | null }>

  let excludedDemoSampleInvoicesWithBalanceDueCount = 0
  const blockingInvoices: OrganizationDeleteInvoiceBlockDetails["blockingInvoices"] = []

  for (const row of rows) {
    const grossPaid = netPaymentsCents(payments, row.id)
    const refunded = netRefundsCents(refunds, row.id)
    const paymentsTotalCents = Math.max(0, grossPaid - refunded)

    const snap = orgInvoiceBalanceDueSnapshot(row, paymentsTotalCents)
    if (!snap.hasOpenBalanceCheck || snap.balanceDueCents <= 0) continue

    if (isOrgInvoiceDemoOrSampleForDeleteGuard(row)) {
      excludedDemoSampleInvoicesWithBalanceDueCount += 1
      continue
    }

    blockingInvoices.push({
      id: row.id,
      invoiceNumber: row.invoice_number != null ? String(row.invoice_number) : null,
      status: String(row.status || ""),
      totalCents: snap.invoiceTotalCents,
      balanceDueCents: snap.balanceDueCents,
      isSample: row.is_sample === true,
      seedKey: row.seed_key,
      customerId: row.customer_id,
      customerLabel: null,
      customerIsSample: null,
    })
  }

  const blockingRealInvoiceCount = blockingInvoices.length

  if (blockingRealInvoiceCount > 0) {
    const custIds = [...new Set(blockingInvoices.map((b) => b.customerId).filter((id): id is string => Boolean(id)))]
    if (custIds.length > 0) {
      const { data: custRows, error: custErr } = await admin
        .from("customers")
        .select("id, company_name, is_sample")
        .eq("organization_id", organizationId)
        .in("id", custIds)

      if (!custErr && custRows?.length) {
        const map = new Map(
          (custRows as Array<{ id: string; company_name: string; is_sample: boolean | null }>).map((c) => [
            c.id,
            { label: c.company_name, isSample: c.is_sample === true },
          ]),
        )
        for (const inv of blockingInvoices) {
          if (!inv.customerId) continue
          const c = map.get(inv.customerId)
          if (c) {
            inv.customerLabel = c.label
            inv.customerIsSample = c.isSample
          }
        }
      }
    }

    const details: OrganizationDeleteInvoiceBlockDetails = {
      excludedDemoSampleInvoicesWithBalanceDueCount,
      blockingRealInvoiceCount,
      blockingInvoices,
    }

    return {
      ok: false,
      httpStatus: 409,
      error: "unpaid_invoices",
      message: `Cannot delete: ${blockingRealInvoiceCount} production invoice(s) still have open accounts receivable (sent, unpaid, or overdue with balance due > $0). Demo, sample, and internal onboarding seed invoices never block deletion. Resolve these production rows in Billing or Invoices (collect, void, or credit as appropriate).${
        excludedDemoSampleInvoicesWithBalanceDueCount > 0
          ? ` (${excludedDemoSampleInvoicesWithBalanceDueCount} demo/sample invoice(s) with balance due were skipped by this check.)`
          : ""
      }`,
      details,
    }
  }

  return { ok: true }
}
