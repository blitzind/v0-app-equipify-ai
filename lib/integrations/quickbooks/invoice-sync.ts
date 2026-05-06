import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseLineItems } from "@/lib/org-quotes-invoices/map"
import { qbFetchJson } from "@/lib/integrations/quickbooks/api"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"
import { upsertExternalMapping } from "@/lib/integrations/quickbooks/mappings"
import { resolveDefaultIncomeAccountId } from "@/lib/integrations/quickbooks/accounts"
import { ensureMiscLineItemId } from "@/lib/integrations/quickbooks/misc-item"
import type { SyncPhaseResult } from "@/lib/integrations/quickbooks/customer-sync"

type QbInvoice = {
  Id?: string
  SyncToken?: string
  sparse?: boolean
  CustomerRef?: { value?: string }
  DocNumber?: string
  TxnDate?: string
  DueDate?: string | null
  PrivateNote?: string | null
  TotalAmt?: number
  Balance?: number
  Line?: Array<Record<string, unknown>>
}

function cents(n: number): number {
  return Math.round(n * 100) / 100
}

export async function syncInvoicesToQuickBooks(params: {
  svc: SupabaseClient
  organizationId: string
  integrationId: string
  realmId: string
  accessToken: string
  onUnauthorized?: () => Promise<string | null>
  /** When set, only these invoice IDs are processed (still skips paid/void/archived). */
  onlyInvoiceIds?: string[]
}): Promise<SyncPhaseResult> {
  const errors: Array<{ internalId: string; message: string }> = []
  let attempted = 0
  let succeeded = 0

  const incomeId = await resolveDefaultIncomeAccountId({
    realmId: params.realmId,
    accessToken: params.accessToken,
    onUnauthorized: params.onUnauthorized,
  })

  if (!incomeId) {
    return {
      attempted: 0,
      succeeded: 0,
      errors: [{ internalId: "_", message: "No Income/Revenue account found in QuickBooks for invoice lines." }],
    }
  }

  const misc = await ensureMiscLineItemId({
    svc: params.svc,
    organizationId: params.organizationId,
    integrationId: params.integrationId,
    realmId: params.realmId,
    accessToken: params.accessToken,
    incomeAccountId: incomeId,
    onUnauthorized: params.onUnauthorized,
  })

  if ("error" in misc) {
    return { attempted: 0, succeeded: 0, errors: [{ internalId: "_", message: misc.error }] }
  }

  const miscItemId = misc.itemId

  const { data: custMaps } = await params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "customer")

  const custQb = new Map<string, string>()
  for (const row of custMaps ?? []) {
    const r = row as { internal_id: string; external_id: string }
    custQb.set(r.internal_id, r.external_id.trim())
  }

  const { data: catMaps } = await params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "catalog_item")

  const catQb = new Map<string, string>()
  for (const row of catMaps ?? []) {
    const r = row as { internal_id: string; external_id: string }
    catQb.set(r.internal_id, r.external_id.trim())
  }

  const { data: invMaps } = await params.svc
    .from("external_sync_mappings")
    .select("internal_id, external_id")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "invoice")

  const invMapById = new Map(
    (invMaps ?? []).map((m) => {
      const r = m as { internal_id: string; external_id: string }
      return [r.internal_id, r] as const
    }),
  )

  let invQuery = params.svc
    .from("org_invoices")
    .select(
      "id, customer_id, invoice_number, title, amount_cents, status, issued_at, due_date, line_items, paid_at, updated_at",
    )
    .eq("organization_id", params.organizationId)
    .is("archived_at", null)

  if (params.onlyInvoiceIds?.length) {
    invQuery = invQuery.in("id", params.onlyInvoiceIds)
  } else {
    invQuery = invQuery.is("paid_at", null).not("status", "eq", "paid").not("status", "eq", "void")
  }

  const { data: invoices, error: invErr } = await invQuery

  if (invErr) {
    return { attempted: 0, succeeded: 0, errors: [{ internalId: "_", message: invErr.message }] }
  }

  for (const raw of invoices ?? []) {
    const inv = raw as {
      id: string
      customer_id: string
      invoice_number: string
      title: string
      amount_cents: number
      status: string
      issued_at: string
      due_date: string | null
      line_items: unknown
      paid_at: string | null
      updated_at?: string
    }

    if (inv.paid_at || inv.status === "paid" || inv.status === "void") continue

    attempted++

    const custId = custQb.get(inv.customer_id)
    if (!custId) {
      errors.push({
        internalId: inv.id,
        message: "Customer is not synced to QuickBooks yet — run customer sync first.",
      })
      continue
    }

    const lines = parseLineItems(inv.line_items)
    let sumCents = 0
    for (const ln of lines) {
      sumCents += Math.round(ln.qty * ln.unit * 100)
    }

    const totalCents = typeof inv.amount_cents === "number" ? inv.amount_cents : 0
    const taxCents = Math.max(0, totalCents - sumCents)

    const qbLines: Array<Record<string, unknown>> = []
    let lineNum = 1

    if (lines.length === 0 && totalCents > 0) {
      qbLines.push({
        LineNum: lineNum++,
        Amount: cents(totalCents / 100),
        DetailType: "SalesItemLineDetail",
        Description: (inv.title || "Invoice").slice(0, 4000),
        SalesItemLineDetail: {
          ItemRef: { value: miscItemId },
          Qty: 1,
          UnitPrice: cents(totalCents / 100),
        },
      })
    } else {
      for (const ln of lines) {
        const unit = cents(ln.unit)
        const qty = ln.qty
        const amount = cents(qty * unit)
        if (amount === 0 && !ln.description.trim()) continue

        let itemRef = miscItemId
        if (ln.catalog_item_id && catQb.has(ln.catalog_item_id)) {
          itemRef = catQb.get(ln.catalog_item_id) as string
        }

        qbLines.push({
          LineNum: lineNum++,
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          Description: ln.description.slice(0, 4000),
          SalesItemLineDetail: {
            ItemRef: { value: itemRef },
            Qty: qty,
            UnitPrice: unit,
          },
        })
      }

      if (taxCents > 0) {
        qbLines.push({
          LineNum: lineNum++,
          Amount: cents(taxCents / 100),
          DetailType: "SalesItemLineDetail",
          Description: "Tax / adjustments (computed from invoice total)",
          SalesItemLineDetail: {
            ItemRef: { value: miscItemId },
            Qty: 1,
            UnitPrice: cents(taxCents / 100),
          },
        })
      }
    }

    if (qbLines.length === 0) {
      errors.push({ internalId: inv.id, message: "Invoice has no billable line items." })
      continue
    }

    const txnDate = inv.issued_at ? inv.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    const dueDate = inv.due_date ? inv.due_date.slice(0, 10) : null
    let docNumber = inv.invoice_number?.trim() || inv.id.slice(0, 8)
    const note = `equipify_invoice:${inv.id}`

    const mappingRow = invMapById.get(inv.id)
    let qboInvId = mappingRow?.external_id?.trim() ?? ""

    const payloadCore = (): QbInvoice => ({
      CustomerRef: { value: custId },
      DocNumber: docNumber,
      TxnDate: txnDate,
      ...(dueDate ? { DueDate: dueDate } : {}),
      PrivateNote: note,
      Line: qbLines as QbInvoice["Line"],
    })

    try {
      if (qboInvId) {
        const getOne = await qbFetchJson<{ Invoice?: QbInvoice }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "GET",
          resourcePath: `invoice/${encodeURIComponent(qboInvId)}`,
          onUnauthorized: params.onUnauthorized,
        })

        const faultGet = readQuickBooksFaultMessage(getOne.data)
        if (!getOne.ok && getOne.status === 404) {
          qboInvId = ""
        } else if (faultGet || !getOne.ok) {
          errors.push({
            internalId: inv.id,
            message: faultGet ?? `Load QuickBooks invoice ${qboInvId} failed (${getOne.status})`,
          })
          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "invoice",
            internalId: inv.id,
            externalId: qboInvId,
            syncStatus: "error",
            lastError: faultGet ?? `HTTP ${getOne.status}`,
          })
          continue
        }

        if (qboInvId) {
          const existing = getOne.data?.Invoice
          const bal = existing?.Balance != null ? Number(existing.Balance) : null
          const total = existing?.TotalAmt != null ? Number(existing.TotalAmt) : null
          if (total != null && bal != null && total > 0 && bal + 0.005 < total) {
            errors.push({
              internalId: inv.id,
              message:
                "Skipped update — QuickBooks shows payments/credits applied (Balance < Total). Avoid overwriting manual adjustments.",
            })
            await upsertExternalMapping({
              svc: params.svc,
              organizationId: params.organizationId,
              entityType: "invoice",
              internalId: inv.id,
              externalId: qboInvId,
              syncStatus: "stale",
              lastError: "Blocked: QB invoice has payments applied.",
            })
            continue
          }

          const merged: QbInvoice = {
            ...existing,
            ...payloadCore(),
            Id: qboInvId,
            SyncToken: existing?.SyncToken,
            sparse: true,
          }

          let upd = await qbFetchJson<{ Invoice?: QbInvoice }>({
            realmId: params.realmId,
            accessToken: params.accessToken,
            method: "POST",
            resourcePath: "invoice",
            searchParams: { sparse: "true" },
            body: merged as Record<string, unknown>,
            onUnauthorized: params.onUnauthorized,
          })

          let faultUp = readQuickBooksFaultMessage(upd.data)
          let updOk = Boolean(upd.ok && !faultUp)

          if (
            !updOk &&
            (upd.rawText?.toLowerCase().includes("duplicate") ||
              (faultUp?.toLowerCase().includes("duplicate") ?? false))
          ) {
            docNumber = `${docNumber}-${inv.id.slice(0, 6)}`
            const merged2: QbInvoice = {
              ...merged,
              ...payloadCore(),
              DocNumber: docNumber,
            }
            upd = await qbFetchJson<{ Invoice?: QbInvoice }>({
              realmId: params.realmId,
              accessToken: params.accessToken,
              method: "POST",
              resourcePath: "invoice",
              searchParams: { sparse: "true" },
              body: merged2 as Record<string, unknown>,
              onUnauthorized: params.onUnauthorized,
            })
            faultUp = readQuickBooksFaultMessage(upd.data)
            updOk = Boolean(upd.ok && !faultUp)
          }

          if (!updOk) {
            errors.push({ internalId: inv.id, message: faultUp ?? `Update invoice failed (${upd.status})` })
            await upsertExternalMapping({
              svc: params.svc,
              organizationId: params.organizationId,
              entityType: "invoice",
              internalId: inv.id,
              externalId: qboInvId,
              syncStatus: "error",
              lastError: faultUp ?? `HTTP ${upd.status}`,
            })
            continue
          }

          await upsertExternalMapping({
            svc: params.svc,
            organizationId: params.organizationId,
            entityType: "invoice",
            internalId: inv.id,
            externalId: qboInvId,
            syncStatus: "synced",
          })
          succeeded++
          continue
        }
      }

      let created = await qbFetchJson<{ Invoice?: QbInvoice }>({
        realmId: params.realmId,
        accessToken: params.accessToken,
        method: "POST",
        resourcePath: "invoice",
        body: payloadCore() as Record<string, unknown>,
        onUnauthorized: params.onUnauthorized,
      })

      let faultCr = readQuickBooksFaultMessage(created.data)
      let newId = created.data?.Invoice?.Id

      if (
        (faultCr?.toLowerCase().includes("duplicate") || created.rawText?.toLowerCase().includes("duplicate")) &&
        !newId
      ) {
        docNumber = `${docNumber}-${inv.id.slice(0, 6)}`
        created = await qbFetchJson<{ Invoice?: QbInvoice }>({
          realmId: params.realmId,
          accessToken: params.accessToken,
          method: "POST",
          resourcePath: "invoice",
          body: payloadCore() as Record<string, unknown>,
          onUnauthorized: params.onUnauthorized,
        })
        faultCr = readQuickBooksFaultMessage(created.data)
        newId = created.data?.Invoice?.Id
      }

      if (faultCr || !created.ok || !newId) {
        errors.push({
          internalId: inv.id,
          message: faultCr ?? `Create invoice failed (${created.status})`,
        })
        continue
      }

      await upsertExternalMapping({
        svc: params.svc,
        organizationId: params.organizationId,
        entityType: "invoice",
        internalId: inv.id,
        externalId: String(newId),
        syncStatus: "synced",
      })
      succeeded++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ internalId: inv.id, message: msg })
    }
  }

  return { attempted, succeeded, errors }
}
