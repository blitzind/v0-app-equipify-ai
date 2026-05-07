import { resolveMapped } from "./map-columns"
import { csvInvoiceStatusToDb } from "./invoice-status"
import { resolveImportStrategy } from "./strategy"
import type { CommitResult, ImportEngineContext, RowOutcome } from "./types"

const HIST_INTERNAL =
  "Historical import — operational record. QuickBooks auto-sync skipped."

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseMoneyToCents(raw: string): number {
  const t = raw.replace(/[$,\s]/g, "")
  if (!t) return 0
  const n = Number.parseFloat(t)
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return s.slice(0, 10)
}

async function resolveCustomerId(
  ctx: ImportEngineContext,
  caches: {
    idByExt: Map<string, string>
    idsByCompany: Map<string, string[]>
  },
  row: Record<string, string>,
): Promise<string | null> {
  const ext = resolveMapped(row, ctx.columnMapping, "customer_external_code")
  const comp = resolveMapped(row, ctx.columnMapping, "customer_company")
  if (ext) {
    const id = caches.idByExt.get(ext.trim().toLowerCase())
    if (id) return id
  }
  if (comp) {
    const cand = caches.idsByCompany.get(normName(comp)) ?? []
    if (cand.length === 1) return cand[0]
  }
  return null
}

type InvoiceRow = {
  id: string
  customer_id: string
  invoice_number: string
  title: string
  amount_cents: number
  status: string
  issued_at: string
  due_date: string | null
  paid_at: string | null
  notes: string | null
  internal_notes: string | null
  equipment_id: string | null
}

export async function commitInvoices(ctx: ImportEngineContext): Promise<CommitResult> {
  const { supabase, organizationId, columnMapping, rows } = ctx
  const strategy = resolveImportStrategy(ctx.options)
  const seedPrefix = ctx.importSeedPrefix ?? `migration-${organizationId.slice(0, 8)}`

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, external_code")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const idByExt = new Map<string, string>()
  const idsByCompany = new Map<string, string[]>()
  for (const c of customers ?? []) {
    const r = c as { id: string; company_name: string; external_code: string | null }
    if (r.external_code?.trim()) idByExt.set(r.external_code.trim().toLowerCase(), r.id)
    const k = normName(r.company_name)
    const arr = idsByCompany.get(k) ?? []
    arr.push(r.id)
    idsByCompany.set(k, arr)
  }

  const caches = { idByExt, idsByCompany }
  const outcomes: RowOutcome[] = []
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  const seenNumbers = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    const invoiceNumber = resolveMapped(row, columnMapping, "invoice_number").trim()
    if (!invoiceNumber) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_invoice_number"],
        message: "Invoice number required.",
      })
      continue
    }

    const numKey = invoiceNumber.toLowerCase()
    if (seenNumbers.has(numKey)) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["duplicate_in_file"],
        message: "Duplicate invoice number in this file.",
      })
      continue
    }
    seenNumbers.add(numKey)

    const customerId = await resolveCustomerId(ctx, caches, row)
    if (!customerId) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["customer_not_found"],
        message: "Customer not found.",
      })
      continue
    }

    const issuedAt = parseDate(resolveMapped(row, columnMapping, "issued_at"))
    if (!issuedAt) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["missing_date"],
        message: "Issue date required.",
      })
      continue
    }

    let equipmentId: string | null = null
    const serial = resolveMapped(row, columnMapping, "equipment_serial")
    if (serial) {
      const { data: eq } = await supabase
        .from("equipment")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .ilike("serial_number", serial.trim())
        .is("archived_at", null)
        .maybeSingle()
      equipmentId = (eq as { id: string } | null)?.id ?? null
    }

    const amountCents = parseMoneyToCents(resolveMapped(row, columnMapping, "amount"))
    const statusDb = csvInvoiceStatusToDb(resolveMapped(row, columnMapping, "status"))
    let paidAt: string | null = null
    if (statusDb === "paid") {
      paidAt = parseDate(resolveMapped(row, columnMapping, "paid_at")) ?? issuedAt
    }

    let dueDate = parseDate(resolveMapped(row, columnMapping, "due_date"))
    if (!dueDate) {
      const base = new Date(issuedAt)
      base.setDate(base.getDate() + 30)
      dueDate = base.toISOString().slice(0, 10)
    }

    const title =
      resolveMapped(row, columnMapping, "title").trim() || `Invoice ${invoiceNumber}`
    const notes = resolveMapped(row, columnMapping, "notes") || null
    const seedKey = `${seedPrefix}-inv-${rowIndex}`

    const { data: exists } = await supabase
      .from("org_invoices")
      .select(
        "id, customer_id, invoice_number, title, amount_cents, status, issued_at, due_date, paid_at, notes, internal_notes, equipment_id",
      )
      .eq("organization_id", organizationId)
      .eq("invoice_number", invoiceNumber)
      .maybeSingle()

    if (exists) {
      const ex = exists as InvoiceRow
      const label = ex.invoice_number

      if (ex.customer_id !== customerId) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["invoice_customer_mismatch"],
          message: "Invoice number exists for a different customer.",
          matchedLabel: label,
        })
        continue
      }

      if (strategy === "skip_duplicates") {
        skippedCount += 1
        outcomes.push({
          rowIndex,
          status: "skipped",
          codes: ["duplicate_invoice"],
          message: "Skipped — invoice number already exists.",
          entityKind: "invoice",
          entityId: ex.id,
          matchedLabel: label,
        })
        continue
      }

      if (strategy === "create_new_only") {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["duplicate_blocked"],
          message: "Invoice already exists — not allowed for “only create new”.",
          matchedLabel: label,
        })
        continue
      }

      const internal_notes =
        ex.internal_notes?.includes("Historical import") || ex.internal_notes?.includes("QuickBooks auto-sync skipped")
          ? ex.internal_notes
          : [ex.internal_notes?.trim() || null, HIST_INTERNAL].filter(Boolean).join("\n\n")

      const patch: Record<string, unknown> = { internal_notes }

      if (strategy === "update_existing") {
        patch.title = title
        patch.amount_cents = amountCents
        patch.status = statusDb
        patch.issued_at = issuedAt
        patch.due_date = dueDate
        patch.paid_at = paidAt
        patch.notes = notes
        if (equipmentId) patch.equipment_id = equipmentId
      } else {
        if (!(ex.title?.trim()) || ex.title === "Invoice") patch.title = title
        if (!ex.amount_cents || ex.amount_cents === 0) patch.amount_cents = amountCents
        if (!(ex.notes?.trim()) && notes) patch.notes = notes
        if (!ex.due_date) patch.due_date = dueDate
        if (!ex.paid_at && paidAt) patch.paid_at = paidAt
        patch.status = statusDb
        if (!ex.equipment_id && equipmentId) patch.equipment_id = equipmentId
      }

      const { error: uErr } = await supabase
        .from("org_invoices")
        .update(patch)
        .eq("id", ex.id)
        .eq("organization_id", organizationId)

      if (uErr) {
        errorCount += 1
        outcomes.push({
          rowIndex,
          status: "error",
          codes: ["update_failed"],
          message: uErr.message,
          matchedLabel: label,
        })
        continue
      }

      updatedCount += 1
      outcomes.push({
        rowIndex,
        status: "updated",
        codes: [],
        message: null,
        entityKind: "invoice",
        entityId: ex.id,
        matchedLabel: label,
      })
      continue
    }

    const insertRow: Record<string, unknown> = {
      organization_id: organizationId,
      customer_id: customerId,
      equipment_id: equipmentId,
      work_order_id: null,
      quote_id: null,
      calibration_record_id: null,
      seed_key: seedKey,
      invoice_number: invoiceNumber,
      title,
      amount_cents: amountCents,
      status: statusDb,
      issued_at: issuedAt,
      due_date: dueDate,
      paid_at: paidAt,
      line_items: [],
      notes,
      internal_notes: HIST_INTERNAL,
    }

    const { data: ins, error } = await supabase
      .from("org_invoices")
      .insert(insertRow)
      .select("id")
      .maybeSingle()

    if (error || !ins) {
      errorCount += 1
      outcomes.push({
        rowIndex,
        status: "error",
        codes: ["insert_failed"],
        message: error?.message ?? "Could not create invoice.",
      })
      continue
    }

    createdCount += 1
    outcomes.push({
      rowIndex,
      status: "imported",
      codes: [],
      message: null,
      entityKind: "invoice",
      entityId: (ins as { id: string }).id,
      matchedLabel: invoiceNumber,
    })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}
