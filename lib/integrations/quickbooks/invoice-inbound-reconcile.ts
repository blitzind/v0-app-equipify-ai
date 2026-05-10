import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { qbFetchJson } from "@/lib/integrations/quickbooks/api"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"
import { upsertExternalMapping } from "@/lib/integrations/quickbooks/mappings"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"
import type { SyncPhaseResult } from "@/lib/integrations/quickbooks/customer-sync"

type QbInvoice = {
  Id?: string
  Balance?: number
  TotalAmt?: number
  TxnDate?: string
}

export type InboundReviewState = "none" | "needs_review" | "apply_available"

export type InvoiceInboundSnapshot = {
  checkedAt: string
  qbBalanceCents: number | null
  qbTotalCents: number | null
  qbFullyPaid: boolean
  qbPartiallyPaid: boolean
  reviewState: InboundReviewState
  reviewReason?: string
  suggestApplyPaidOn?: string
}

const CENTS_TOLERANCE = 2

function dollarsToCents(n: number): number {
  return Math.round(n * 100)
}

function parseInboundFromMetadata(raw: unknown): Partial<InvoiceInboundSnapshot> | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  return {
    checkedAt: typeof o.checkedAt === "string" ? o.checkedAt : undefined,
    qbBalanceCents: typeof o.qbBalanceCents === "number" ? o.qbBalanceCents : undefined,
    qbTotalCents: typeof o.qbTotalCents === "number" ? o.qbTotalCents : undefined,
    qbFullyPaid: typeof o.qbFullyPaid === "boolean" ? o.qbFullyPaid : undefined,
    qbPartiallyPaid: typeof o.qbPartiallyPaid === "boolean" ? o.qbPartiallyPaid : undefined,
    reviewState:
      o.reviewState === "none" || o.reviewState === "needs_review" || o.reviewState === "apply_available"
        ? o.reviewState
        : undefined,
    reviewReason: typeof o.reviewReason === "string" ? o.reviewReason : undefined,
    suggestApplyPaidOn: typeof o.suggestApplyPaidOn === "string" ? o.suggestApplyPaidOn : undefined,
  }
}

/**
 * Reads the last inbound reconcile snapshot stored on the invoice mapping row (metadata.inbound).
 */
export function readInvoiceInboundSnapshot(metadata: unknown): InvoiceInboundSnapshot | null {
  if (!metadata || typeof metadata !== "object") return null
  const inbound = (metadata as { inbound?: unknown }).inbound
  if (!inbound || typeof inbound !== "object") return null
  const p = parseInboundFromMetadata(inbound)
  if (!p?.checkedAt || !p.reviewState) return null
  return {
    checkedAt: p.checkedAt,
    qbBalanceCents: p.qbBalanceCents ?? null,
    qbTotalCents: p.qbTotalCents ?? null,
    qbFullyPaid: Boolean(p.qbFullyPaid),
    qbPartiallyPaid: Boolean(p.qbPartiallyPaid),
    reviewState: p.reviewState,
    reviewReason: p.reviewReason,
    suggestApplyPaidOn: p.suggestApplyPaidOn,
  }
}

/**
 * Returns true when the stored inbound snapshot still allows applying QB-paid → Equipify paid.
 * Caller must re-fetch QuickBooks before writing.
 */
export function inboundSnapshotAllowsApplyPaid(snapshot: InvoiceInboundSnapshot | null): boolean {
  if (!snapshot) return false
  return snapshot.reviewState === "apply_available" && Boolean(snapshot.suggestApplyPaidOn?.trim())
}

function buildInboundPayload(args: {
  checkedAt: string
  qbBalanceCents: number | null
  qbTotalCents: number | null
  qbFullyPaid: boolean
  qbPartiallyPaid: boolean
  reviewState: InboundReviewState
  reviewReason?: string
  suggestApplyPaidOn?: string
  history: unknown[]
}): Record<string, unknown> {
  return {
    checkedAt: args.checkedAt,
    qbBalanceCents: args.qbBalanceCents,
    qbTotalCents: args.qbTotalCents,
    qbFullyPaid: args.qbFullyPaid,
    qbPartiallyPaid: args.qbPartiallyPaid,
    reviewState: args.reviewState,
    ...(args.reviewReason ? { reviewReason: args.reviewReason } : {}),
    ...(args.suggestApplyPaidOn ? { suggestApplyPaidOn: args.suggestApplyPaidOn } : {}),
    history: args.history,
  }
}

/**
 * Pull QuickBooks invoice balances for mapped org_invoices rows and write conflict-safe review state
 * into external_sync_mappings.metadata.inbound (no automatic writes to org_invoices).
 */
export async function reconcileQuickBooksInvoiceInboundStatuses(params: {
  svc: SupabaseClient
  organizationId: string
  realmId: string
  accessToken: string
  onUnauthorized?: () => Promise<string | null>
  onlyInvoiceIds?: string[]
}): Promise<SyncPhaseResult> {
  const errors: Array<{ internalId: string; message: string }> = []
  let attempted = 0
  let succeeded = 0

  let mapQuery = params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id, sync_status, metadata, last_error")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "invoice")

  if (params.onlyInvoiceIds?.length) {
    mapQuery = mapQuery.in("internal_id", params.onlyInvoiceIds)
  }

  const { data: maps, error: mapErr } = await mapQuery
  if (mapErr) {
    return { attempted: 0, succeeded: 0, errors: [{ internalId: "_", message: mapErr.message }] }
  }

  const rows = maps ?? []
  if (rows.length === 0) {
    return { attempted: 0, succeeded: 0, errors: [] }
  }

  const invoiceIds = rows.map((r) => (r as { internal_id: string }).internal_id)
  const { data: invRows, error: invErr } = await params.svc
    .from("org_invoices")
    .select("id, amount_cents, tax_amount_cents, status, paid_at")
    .eq("organization_id", params.organizationId)
    .in("id", invoiceIds)

  if (invErr) {
    return { attempted: 0, succeeded: 0, errors: [{ internalId: "_", message: invErr.message }] }
  }

  const invById = new Map(
    (invRows ?? []).map((r) => {
      const row = r as {
        id: string
        amount_cents: number
        tax_amount_cents?: number | null
        status: string
        paid_at?: string | null
      }
      return [row.id, row] as const
    }),
  )

  const { data: payRows, error: payErr } = await params.svc
    .from("org_invoice_payments")
    .select("invoice_id, amount_cents")
    .eq("organization_id", params.organizationId)
    .in("invoice_id", invoiceIds)

  if (payErr) {
    return { attempted: 0, succeeded: 0, errors: [{ internalId: "_", message: payErr.message }] }
  }

  const paySumByInvoice = new Map<string, number>()
  for (const p of payRows ?? []) {
    const row = p as { invoice_id: string; amount_cents: number }
    const id = row.invoice_id
    paySumByInvoice.set(id, (paySumByInvoice.get(id) ?? 0) + Math.round(Number(row.amount_cents)))
  }

  const checkedAt = new Date().toISOString()

  for (const m of rows) {
    const internalId = (m as { internal_id: string }).internal_id
    const externalId = String((m as { external_id: string }).external_id ?? "").trim()
    const prevSyncStatus = String((m as { sync_status: string }).sync_status || "synced")
    const prevLastError = (m as { last_error?: string | null }).last_error ?? null
    const rawMeta = (m as { metadata?: unknown }).metadata
    const prevMetaObj: Record<string, unknown> =
      rawMeta && typeof rawMeta === "object" ? { ...(rawMeta as Record<string, unknown>) } : {}
    const prevInboundRaw = prevMetaObj.inbound
    const prevInboundObj: Record<string, unknown> =
      prevInboundRaw && typeof prevInboundRaw === "object" ? { ...(prevInboundRaw as Record<string, unknown>) } : {}
    const hist: unknown[] = Array.isArray(prevInboundObj.history) ? [...(prevInboundObj.history as unknown[])] : []

    if (!externalId) {
      errors.push({ internalId, message: "Missing QuickBooks invoice id on mapping." })
      continue
    }

    const inv = invById.get(internalId)
    if (!inv) {
      errors.push({ internalId, message: "Invoice not found for mapping." })
      continue
    }

    const st = String(inv.status || "")
    if (st === "void" || st === "draft") {
      const reviewState: InboundReviewState = "none"
      hist.push({ at: checkedAt, reviewState, note: "skipped_draft_or_void" })
      if (hist.length > 8) hist.splice(0, hist.length - 8)
      await upsertExternalMapping({
        svc: params.svc,
        organizationId: params.organizationId,
        entityType: "invoice",
        internalId,
        externalId,
        syncStatus: prevSyncStatus === "error" ? "error" : prevSyncStatus,
        lastError: prevLastError,
        metadata: {
          ...prevMetaObj,
          inbound: buildInboundPayload({
            checkedAt,
            qbBalanceCents: null,
            qbTotalCents: null,
            qbFullyPaid: false,
            qbPartiallyPaid: false,
            reviewState,
            history: hist,
          }),
        },
      })
      continue
    }

    attempted++

    const getOne = await qbFetchJson<{ Invoice?: QbInvoice }>({
      realmId: params.realmId,
      accessToken: params.accessToken,
      method: "GET",
      resourcePath: `invoice/${encodeURIComponent(externalId)}`,
      onUnauthorized: params.onUnauthorized,
    })

    const faultGet = readQuickBooksFaultMessage(getOne.data)
    if (!getOne.ok || faultGet) {
      const msg = faultGet ?? `Load QuickBooks invoice failed (${getOne.status})`
      errors.push({ internalId, message: msg })
      hist.push({ at: checkedAt, reviewState: "needs_review", error: "qb_fetch_failed" })
      if (hist.length > 8) hist.splice(0, hist.length - 8)
      await upsertExternalMapping({
        svc: params.svc,
        organizationId: params.organizationId,
        entityType: "invoice",
        internalId,
        externalId,
        syncStatus: "error",
        lastError: msg,
        metadata: {
          ...prevMetaObj,
          inbound: buildInboundPayload({
            checkedAt,
            qbBalanceCents: null,
            qbTotalCents: null,
            qbFullyPaid: false,
            qbPartiallyPaid: false,
            reviewState: "needs_review",
            reviewReason: "Could not read QuickBooks invoice for payment status.",
            history: hist,
          }),
        },
      })
      continue
    }

    const qbInv = getOne.data?.Invoice
    const bal = qbInv?.Balance != null ? Number(qbInv.Balance) : null
    const total = qbInv?.TotalAmt != null ? Number(qbInv.TotalAmt) : null
    const qbBalanceCents = bal != null ? dollarsToCents(bal) : null
    const qbTotalCents = total != null ? dollarsToCents(total) : null

    const totalDue = invoiceGrandTotalCents(inv)
    const sumPay = paySumByInvoice.get(internalId) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: totalDue,
      paymentsTotalCents: sumPay,
      dbInvoiceStatus: st,
    })

    const qbFullyPaid =
      qbTotalCents != null &&
      qbTotalCents > CENTS_TOLERANCE &&
      qbBalanceCents != null &&
      qbBalanceCents <= CENTS_TOLERANCE

    const qbPartiallyPaid =
      qbTotalCents != null &&
      qbBalanceCents != null &&
      qbTotalCents > CENTS_TOLERANCE &&
      qbBalanceCents > CENTS_TOLERANCE &&
      qbBalanceCents < qbTotalCents - CENTS_TOLERANCE

    let reviewState: InboundReviewState = "none"
    let reviewReason: string | undefined
    let suggestApplyPaidOn: string | undefined

    if (qbTotalCents != null && Math.abs(qbTotalCents - totalDue) > CENTS_TOLERANCE) {
      reviewState = "needs_review"
      reviewReason = "Invoice total does not match QuickBooks; manual review required."
    } else if (qbBalanceCents != null && Math.abs(qbBalanceCents - alloc.balanceDueCents) > CENTS_TOLERANCE) {
      if (qbFullyPaid && sumPay > 0) {
        reviewState = "needs_review"
        reviewReason =
          "QuickBooks shows this invoice paid, but Equipify has recorded payments. Reconcile before changing paid status."
      } else if (qbFullyPaid && alloc.allocationState !== "paid" && sumPay === 0) {
        const txn = qbInv?.TxnDate?.trim()
        const paidOn =
          txn && txn.length >= 10
            ? txn.slice(0, 10)
            : checkedAt.slice(0, 10)
        reviewState = "apply_available"
        suggestApplyPaidOn = paidOn
      } else if (!qbFullyPaid && alloc.allocationState === "paid") {
        reviewState = "needs_review"
        reviewReason = "Equipify shows paid in full, but QuickBooks still shows a balance."
      } else if (qbPartiallyPaid || (qbBalanceCents != null && qbBalanceCents > CENTS_TOLERANCE)) {
        reviewState = "needs_review"
        reviewReason = "QuickBooks balance does not match Equipify payments; review allocation in both systems."
      } else {
        reviewState = "needs_review"
        reviewReason = "QuickBooks payment status does not match Equipify."
      }
    }

    hist.push({ at: checkedAt, reviewState, qbFullyPaid })
    if (hist.length > 8) hist.splice(0, hist.length - 8)

    await upsertExternalMapping({
      svc: params.svc,
      organizationId: params.organizationId,
      entityType: "invoice",
      internalId,
      externalId,
      syncStatus: prevSyncStatus,
      lastError: prevLastError,
      metadata: {
        ...prevMetaObj,
        inbound: buildInboundPayload({
          checkedAt,
          qbBalanceCents,
          qbTotalCents,
          qbFullyPaid,
          qbPartiallyPaid,
          reviewState,
          reviewReason,
          suggestApplyPaidOn,
          history: hist,
        }),
      },
    })

    succeeded++
  }

  return { attempted, succeeded, errors }
}
