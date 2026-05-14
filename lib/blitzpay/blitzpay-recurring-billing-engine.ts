import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays } from "date-fns"
import { blitzpayMembershipInvoiceGenerationKeyV1 } from "@/lib/blitzpay/idempotency-keys"
import {
  computeBillingPeriodEndUtc,
  insertMembershipEvent,
  MEMBERSHIP_DUE_SCAN_CAP,
  MEMBERSHIP_SNAPSHOT_ORG_CAP,
  nextBillingPeriodStartYmd,
  fetchBlitzpayMembershipDashboard,
} from "@/lib/blitzpay/blitzpay-memberships"
import { insertOrgInvoice } from "@/lib/org-quotes-invoices/repository"
import { billingAddressFromCustomerLike, lineItemsForTaxEngine, mapSalesTaxToInvoiceInsertFields } from "@/lib/tax/invoice-tax-bridge"
import { resolveSalesTaxForLines } from "@/lib/tax/resolve-document-sales-tax"
import { BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS } from "@/lib/blitzpay/blitzpay-recurring-autopay-rules"

export type BlitzpayMembershipCronResult = {
  organizationsScanned: number
  invoicesCreated: number
  invoicesSkippedIdempotent: number
  delinquentMarked: number
  snapshotsWritten: number
  failureRetriesAdvanced: number
  eventsLogged: number
  errors: string[]
}

async function membershipGenerationKeyExists(
  admin: SupabaseClient,
  organizationId: string,
  key: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("blitzpay_membership_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invoice_generation_key", key)
    .maybeSingle()
  if (error) return true
  return Boolean(data)
}

export async function generateMembershipInvoiceIfDue(
  admin: SupabaseClient,
  membership: {
    id: string
    organization_id: string
    customer_id: string
    membership_number: string
    billing_frequency: string
    recurring_amount_cents: number
    next_invoice_at: string
  },
  generatedBy: "scheduler" | "manual" | "renewal",
): Promise<"created" | "skipped" | "error"> {
  const orgId = membership.organization_id
  const periodStart = membership.next_invoice_at.slice(0, 10)
  const periodEnd = computeBillingPeriodEndUtc(periodStart, membership.billing_frequency)
  const genKey = blitzpayMembershipInvoiceGenerationKeyV1({
    membershipId: membership.id,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    generatedBy,
  })
  if (await membershipGenerationKeyExists(admin, orgId, genKey)) return "skipped"

  const amountCents = Math.max(0, Math.round(Number(membership.recurring_amount_cents)))
  if (amountCents < 50) return "skipped"

  const unit = amountCents / 100
  const dueDate = addDays(new Date(`${periodEnd}T12:00:00Z`), 14).toISOString().slice(0, 10)

  const lineItems = [
    {
      description: `Recurring membership (${membership.billing_frequency}) — ${periodStart} → ${periodEnd}`,
      qty: 1,
      unit,
      source_ref: `blitzpay_membership:${membership.id}`,
    },
  ]

  const { data: custRow } = await admin
    .from("customers")
    .select(
      "id, tax_exempt, default_tax_basis, billing_country, billing_state, billing_city, billing_postal_code",
    )
    .eq("organization_id", orgId)
    .eq("id", membership.customer_id)
    .maybeSingle()

  const cust = custRow as {
    id: string
    tax_exempt: boolean | null
    default_tax_basis: string | null
    billing_country: string | null
    billing_state: string | null
    billing_city: string | null
    billing_postal_code: string | null
  } | null

  const addr = cust ? billingAddressFromCustomerLike(cust) : { countryCode: "US", regionCode: "" }
  const resolution = await resolveSalesTaxForLines(admin, {
    organizationId: orgId,
    customerId: membership.customer_id,
    preferAutomatic: true,
    lines: lineItemsForTaxEngine(lineItems),
    taxBasis: cust?.default_tax_basis === "service_location" ? "service_location" : "billing_address",
    serviceAddress: addr,
    billingAddress: addr,
    customerTaxExempt: cust?.tax_exempt === true,
    asOfYmd: periodStart,
    persistLog: true,
    auditSourceType: "blitzpay_membership_invoice",
    actorUserId: null,
  })

  const uiMode = resolution.status === "exempt" ? "exempt" : resolution.status !== "skipped" ? "automated" : "manual"
  const taxFields = mapSalesTaxToInvoiceInsertFields({ resolution, uiMode })

  const res = await insertOrgInvoice(admin, {
    organizationId: orgId,
    customerId: membership.customer_id,
    equipmentId: null,
    workOrderId: null,
    quoteId: null,
    calibrationRecordId: null,
    title: `Membership ${membership.membership_number}`,
    amountCents,
    status: "Draft",
    issuedAt: periodStart,
    dueDate,
    paidAt: null,
    lineItems,
    notes: `Membership billing period ${periodStart} – ${periodEnd}.`,
    internalNotes: `BlitzPay membership trace\nmembership_id:${membership.id}\ngeneration_key:${genKey}`,
    taxCalculationMode: taxFields.taxCalculationMode,
    taxBasis: taxFields.taxBasis,
    taxJurisdictionLabel: taxFields.taxJurisdictionLabel,
    taxRatePercent: taxFields.taxRatePercent,
    taxAmount: taxFields.taxAmount,
    taxableSubtotal: taxFields.taxableSubtotal,
    nonTaxableSubtotal: taxFields.nonTaxableSubtotal,
    taxExemptionApplied: taxFields.taxExemptionApplied,
    taxExemptionReason: taxFields.taxExemptionReason,
    taxProvider: taxFields.taxProvider,
    taxProviderReference: taxFields.taxProviderReference,
    taxSnapshotJson: taxFields.taxSnapshotJson,
  })
  if (res.error || !res.id) return "error"

  const { error: linkErr } = await admin.from("blitzpay_membership_invoices").insert({
    organization_id: orgId,
    membership_id: membership.id,
    org_invoice_id: res.id,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    generated_by: generatedBy,
    invoice_generation_key: genKey,
  })
  if (linkErr) return "error"

  const nextStart = nextBillingPeriodStartYmd(periodStart, membership.billing_frequency)
  const nextIso = new Date(`${nextStart}T15:00:00.000Z`).toISOString()
  const { error: upErr } = await admin
    .from("blitzpay_memberships")
    .update({ next_invoice_at: nextIso, updated_at: new Date().toISOString() })
    .eq("id", membership.id)
    .eq("organization_id", orgId)
  if (upErr) return "error"

  await insertMembershipEvent(admin, {
    organizationId: orgId,
    membershipId: membership.id,
    eventType: "invoice_generated",
    eventSummary: `Draft invoice created for period ${periodStart}–${periodEnd}.`,
    metadata: { org_invoice_id: res.id, generation_key: genKey },
  })
  return "created"
}

export async function runBlitzpayMembershipsCron(admin: SupabaseClient): Promise<BlitzpayMembershipCronResult> {
  const errors: string[] = []
  let organizationsScanned = 0
  let invoicesCreated = 0
  let invoicesSkippedIdempotent = 0
  let delinquentMarked = 0
  let snapshotsWritten = 0
  let failureRetriesAdvanced = 0
  let eventsLogged = 0

  const nowIso = new Date().toISOString()
  const { data: orgRows, error: orgErr } = await admin
    .from("blitzpay_memberships")
    .select("organization_id")
    .eq("status", "active")
    .lte("next_invoice_at", nowIso)
    .limit(800)
  if (orgErr) {
    errors.push(orgErr.message)
    return {
      organizationsScanned: 0,
      invoicesCreated: 0,
      invoicesSkippedIdempotent: 0,
      delinquentMarked: 0,
      snapshotsWritten: 0,
      failureRetriesAdvanced: 0,
      eventsLogged: 0,
      errors,
    }
  }
  const orgIds = [...new Set((orgRows ?? []).map((r) => (r as { organization_id: string }).organization_id))].slice(
    0,
    MEMBERSHIP_SNAPSHOT_ORG_CAP,
  )

  for (const organizationId of orgIds) {
    organizationsScanned += 1
    const { data: due, error: dErr } = await admin
      .from("blitzpay_memberships")
      .select("id, organization_id, customer_id, membership_number, billing_frequency, recurring_amount_cents, next_invoice_at")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .lte("next_invoice_at", nowIso)
      .order("next_invoice_at", { ascending: true })
      .limit(MEMBERSHIP_DUE_SCAN_CAP)
    if (dErr) {
      errors.push(dErr.message)
      continue
    }
    for (const row of due ?? []) {
      const m = row as {
        id: string
        organization_id: string
        customer_id: string
        membership_number: string
        billing_frequency: string
        recurring_amount_cents: number
        next_invoice_at: string
      }
      try {
        const r = await generateMembershipInvoiceIfDue(admin, m, "scheduler")
        if (r === "created") {
          invoicesCreated += 1
          eventsLogged += 1
        } else if (r === "skipped") invoicesSkippedIdempotent += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    try {
      const { data: failsRaw, error: fErr } = await admin
        .from("blitzpay_membership_payment_failures")
        .select("id, membership_id, retry_count, next_retry_at, recovery_status")
        .eq("organization_id", organizationId)
        .eq("recovery_status", "open")
        .lt("retry_count", 4)
        .limit(80)
      const fails = (failsRaw ?? []).filter((row) => {
        const f = row as { next_retry_at: string | null }
        if (!f.next_retry_at) return true
        return f.next_retry_at <= nowIso
      })
      if (!fErr && fails.length) {
        for (const f of fails as Array<{ id: string; membership_id: string; retry_count: number }>) {
          const idx = Math.min(f.retry_count, BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS.length - 1)
          const hours = BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS[Math.max(0, idx)] ?? 72
          const next = new Date(Date.now() + hours * 3600_000).toISOString()
          const newCount = f.retry_count + 1
          const { error: uErr } = await admin
            .from("blitzpay_membership_payment_failures")
            .update({
              retry_count: newCount,
              next_retry_at: next,
              updated_at: nowIso,
              recovery_status: newCount >= 4 ? "written_off" : "open",
            })
            .eq("id", f.id)
            .eq("organization_id", organizationId)
          if (!uErr) {
            failureRetriesAdvanced += 1
            if (newCount >= 4) {
              await admin
                .from("blitzpay_memberships")
                .update({ status: "delinquent", updated_at: nowIso })
                .eq("id", f.membership_id)
                .eq("organization_id", organizationId)
              delinquentMarked += 1
            }
          }
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }

    try {
      const dash = await fetchBlitzpayMembershipDashboard(admin, organizationId)
      const today = nowIso.slice(0, 10)
      const { error: snapErr } = await admin.from("blitzpay_membership_retention_snapshots").upsert(
        {
          organization_id: organizationId,
          snapshot_date: today,
          active_memberships: dash.activeCount,
          churned_memberships: dash.canceledWindowCount,
          mrr_cents: dash.mrrCents,
          arr_cents: dash.arrCents,
          delinquent_memberships: dash.delinquentCount,
          renewal_rate_basis_points: Math.min(10_000, Math.round(dash.autopayAdoptionPct * 100)),
          auto_pay_adoption_basis_points: Math.min(10_000, Math.round(dash.autopayAdoptionPct * 100)),
        },
        { onConflict: "organization_id,snapshot_date" },
      )
      if (!snapErr) snapshotsWritten += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }

  }

  return {
    organizationsScanned,
    invoicesCreated,
    invoicesSkippedIdempotent,
    delinquentMarked,
    snapshotsWritten,
    failureRetriesAdvanced,
    eventsLogged,
    errors,
  }
}
