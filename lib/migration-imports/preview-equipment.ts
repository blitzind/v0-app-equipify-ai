import { resolveMapped } from "./map-columns"
import type { PreviewIssue, PreviewResult, PreviewSampleRow } from "./public-types"
import type { ImportEngineContext } from "./types"
import { MIGRATION_IMPORT_MAX_ROWS } from "./constants"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function buildEquipmentPreview(
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

  const { data: equipRows } = await supabase
    .from("equipment")
    .select("serial_number")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const serials = new Set<string>()
  for (const e of equipRows ?? []) {
    const sn = (e as { serial_number: string | null }).serial_number?.trim()
    if (sn) serials.add(sn.toLowerCase())
  }

  const duplicateHints: { rowIndex: number; message: string }[] = []
  const unresolvedRefs: { rowIndex: number; message: string }[] = []
  const sampleRows: PreviewSampleRow[] = []
  let errorRows = 0
  let warningRows = 0
  let okRows = 0

  const fileSerials = new Set<string>()
  const maxScan = Math.min(rows.length, MIGRATION_IMPORT_MAX_ROWS)

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i]
    const rowIndex = i + 1
    const issues: PreviewIssue[] = []

    const name = resolveMapped(row, columnMapping, "name")
    if (!name) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_name",
        message: "Equipment name is required.",
      })
    }

    const ext = resolveMapped(row, columnMapping, "customer_external_code")
    const comp = resolveMapped(row, columnMapping, "customer_company")
    if (!ext && !comp) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_customer_ref",
        message: "Provide customer external code and/or company name to link this asset.",
      })
    } else {
      let resolved: string | null = null
      if (ext) resolved = idByExt.get(ext.trim().toLowerCase()) ?? null
      if (!resolved && comp) {
        const cand = idsByCompany.get(normName(comp)) ?? []
        if (cand.length === 1) resolved = cand[0]
        else if (cand.length > 1) {
          issues.push({
            rowIndex,
            severity: "warning",
            code: "ambiguous_customer",
            message: "Multiple customers match this company name — add customer_external_code.",
          })
          unresolvedRefs.push({
            rowIndex,
            message: "Ambiguous customer match — refine external code.",
          })
        }
      }
      if (!resolved && ext && !issues.some((x) => x.code === "ambiguous_customer")) {
        unresolvedRefs.push({
          rowIndex,
          message: "Customer external code not found — create customer first or fix code.",
        })
        issues.push({
          rowIndex,
          severity: "error",
          code: "customer_not_found",
          message: "No customer matches this external code.",
        })
      }
      if (!resolved && comp && !idsByCompany.has(normName(comp))) {
        unresolvedRefs.push({ rowIndex, message: "Company name not found." })
        issues.push({
          rowIndex,
          severity: "error",
          code: "customer_not_found",
          message: "No customer matches this company name.",
        })
      }
    }

    const serial = resolveMapped(row, columnMapping, "serial_number")
    if (serial) {
      const low = serial.toLowerCase()
      if (serials.has(low)) {
        duplicateHints.push({ rowIndex, message: "Serial number exists on another asset." })
        issues.push({
          rowIndex,
          severity: "warning",
          code: "duplicate_serial",
          message: "Serial already in Equipify — row may be skipped.",
        })
      }
      if (fileSerials.has(low)) {
        issues.push({
          rowIndex,
          severity: "error",
          code: "duplicate_serial_file",
          message: "Duplicate serial within this file.",
        })
      }
      fileSerials.add(low)
    }

    const hasError = issues.some((x) => x.severity === "error")
    const hasWarn = issues.some((x) => x.severity === "warning")
    if (hasError) errorRows += 1
    else if (hasWarn) warningRows += 1
    else okRows += 1

    if (sampleRows.length < 20) {
      const cells: Record<string, string> = {}
      for (const k of ["name", "serial_number", "customer_external_code", "manufacturer"] as const) {
        const v = resolveMapped(row, columnMapping, k)
        if (v) cells[k] = v.length > 40 ? `${v.slice(0, 37)}…` : v
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
