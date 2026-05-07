import { resolveMapped } from "./map-columns"
import type { PreviewIssue, PreviewResult, PreviewSampleRow } from "./public-types"
import type { ImportEngineContext } from "./types"
import { MIGRATION_IMPORT_MAX_ROWS } from "./constants"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function buildWorkOrderPreview(
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

    const title = resolveMapped(row, columnMapping, "title")
    if (!title) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_title",
        message: "Title / description is required.",
      })
    }

    const ext = resolveMapped(row, columnMapping, "customer_external_code")
    const comp = resolveMapped(row, columnMapping, "customer_company")
    const serial = resolveMapped(row, columnMapping, "equipment_serial")

    if (!ext && !comp) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_customer",
        message: "Customer reference required.",
      })
    }

    if (!serial) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_equipment",
        message: "Equipment serial is required to link service history.",
      })
    }

    const extId = ext ? idByExt.get(ext.trim().toLowerCase()) : undefined
    const compIds = comp ? idsByCompany.get(normName(comp)) : undefined
    const customerResolved =
      extId ?? (compIds?.length === 1 ? compIds[0] : undefined)

    if ((ext || comp) && !customerResolved) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "customer_not_found",
        message: "Customer could not be matched.",
      })
      unresolvedRefs.push({ rowIndex, message: "Customer not found." })
    }

    if (customerResolved && serial) {
      const { data: eq } = await supabase
        .from("equipment")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerResolved)
        .ilike("serial_number", serial.trim())
        .is("archived_at", null)
        .maybeSingle()
      if (!eq) {
        issues.push({
          rowIndex,
          severity: "error",
          code: "equipment_not_found",
          message: "No equipment with this serial for the matched customer.",
        })
        unresolvedRefs.push({ rowIndex, message: "Equipment serial not found under customer." })
      }
    }

    const hasError = issues.some((x) => x.severity === "error")
    const hasWarn = issues.some((x) => x.severity === "warning")
    if (hasError) errorRows += 1
    else if (hasWarn) warningRows += 1
    else okRows += 1

    if (sampleRows.length < 20) {
      const cells: Record<string, string> = {}
      for (const k of ["title", "completed_at", "status", "equipment_serial"] as const) {
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
