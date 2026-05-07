import { resolveMapped } from "./map-columns"
import type { PreviewIssue, PreviewResult, PreviewSampleRow } from "./public-types"
import type { ImportEngineContext } from "./types"
import { MIGRATION_IMPORT_MAX_ROWS } from "./constants"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function buildInvoicePreview(
  ctx: ImportEngineContext,
): Promise<PreviewResult> {
  const { supabase, organizationId, columnMapping, rows } = ctx

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

  const { data: invNums } = await supabase
    .from("org_invoices")
    .select("invoice_number")
    .eq("organization_id", organizationId)

  const numbers = new Set<string>()
  for (const r of invNums ?? []) {
    const n = (r as { invoice_number: string }).invoice_number?.trim().toLowerCase()
    if (n) numbers.add(n)
  }

  const duplicateHints: { rowIndex: number; message: string }[] = []
  const unresolvedRefs: { rowIndex: number; message: string }[] = []
  const sampleRows: PreviewSampleRow[] = []
  let errorRows = 0
  let warningRows = 0
  let okRows = 0

  const maxScan = Math.min(rows.length, MIGRATION_IMPORT_MAX_ROWS)

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i]
    const rowIndex = i + 1
    const issues: PreviewIssue[] = []

    const invNo = resolveMapped(row, columnMapping, "invoice_number")
    if (!invNo) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_invoice_number",
        message: "Invoice number is required for historical continuity.",
      })
    } else if (numbers.has(invNo.trim().toLowerCase())) {
      duplicateHints.push({ rowIndex, message: "Invoice number already exists in Equipify." })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_invoice_number",
        message: "Possible duplicate invoice number.",
      })
    }

    const amount = resolveMapped(row, columnMapping, "amount")
    if (!amount) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "missing_amount",
        message: "Amount missing — defaults to zero.",
      })
    }

    const issued = resolveMapped(row, columnMapping, "issued_at")
    if (!issued) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_date",
        message: "Issue date is required.",
      })
    }

    const ext = resolveMapped(row, columnMapping, "customer_external_code")
    const comp = resolveMapped(row, columnMapping, "customer_company")
    if (!ext && !comp) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_customer",
        message: "Customer reference required.",
      })
    } else {
      let resolved = false
      if (ext && idByExt.has(ext.trim().toLowerCase())) resolved = true
      if (!resolved && comp && (idsByCompany.get(normName(comp))?.length === 1)) resolved = true
      if (!resolved) {
        issues.push({
          rowIndex,
          severity: "error",
          code: "customer_not_found",
          message: "Could not match customer.",
        })
        unresolvedRefs.push({ rowIndex, message: "Customer not found." })
      }
    }

    const hasError = issues.some((x) => x.severity === "error")
    const hasWarn = issues.some((x) => x.severity === "warning")
    if (hasError) errorRows += 1
    else if (hasWarn) warningRows += 1
    else okRows += 1

    if (sampleRows.length < 20) {
      const cells: Record<string, string> = {}
      for (const k of ["invoice_number", "amount", "issued_at", "status"] as const) {
        const v = resolveMapped(row, columnMapping, k)
        if (v) cells[k] = v.length > 36 ? `${v.slice(0, 33)}…` : v
      }
      sampleRows.push({ rowIndex, cells, issues })
    }
  }

  return {
    rowCount: rows.length,
    truncated: rows.length > MIGRATION_IMPORT_MAX_ROWS,
    duplicateHints,
    unresolvedRefs,
    sampleRows,
    summary: { errorRows, warningRows, okRows },
  }
}
