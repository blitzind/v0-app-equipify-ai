import { resolveMapped } from "./map-columns"
import type { PreviewIssue, PreviewResult, PreviewSampleRow } from "./public-types"
import type { ImportEngineContext } from "./types"
import { MIGRATION_IMPORT_MAX_ROWS } from "./constants"

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function buildCustomerPreview(
  ctx: ImportEngineContext,
): Promise<PreviewResult> {
  const { supabase, organizationId, columnMapping, rows } = ctx

  const { data: existing } = await supabase
    .from("customers")
    .select("id, company_name, external_code")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  const byCode = new Map<string, { name: string }>()
  const byName = new Map<string, { code: string | null }>()
  for (const c of existing ?? []) {
    const r = c as { company_name: string; external_code: string | null }
    if (r.external_code?.trim()) {
      byCode.set(r.external_code.trim().toLowerCase(), { name: r.company_name })
    }
    byName.set(normName(r.company_name), { code: r.external_code })
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

    let company =
      resolveMapped(row, columnMapping, "company_name") ||
      resolveMapped(row, columnMapping, "contact_full_name")
    if (!company) {
      issues.push({
        rowIndex,
        severity: "error",
        code: "missing_company",
        message: "Company name (or contact name) is required.",
      })
    }

    const ext = resolveMapped(row, columnMapping, "external_code")
    if (ext && byCode.has(ext.toLowerCase())) {
      duplicateHints.push({
        rowIndex,
        message: `External code matches existing account (${ext.trim()}).`,
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_external_code",
        message: "Matches existing customer by external code — row may be skipped depending on your duplicate strategy.",
      })
    }

    if (company && byName.has(normName(company))) {
      duplicateHints.push({
        rowIndex,
        message: `Company name matches existing account (${company.trim()}).`,
      })
      issues.push({
        rowIndex,
        severity: "warning",
        code: "duplicate_company_name",
        message: "Possible duplicate company name — review before committing.",
      })
    }

    const a1 = resolveMapped(row, columnMapping, "address_line1")
    const city = resolveMapped(row, columnMapping, "city")
    const state = resolveMapped(row, columnMapping, "state")
    const postal = resolveMapped(row, columnMapping, "postal_code")
    const anyAddr = Boolean(a1 || city || state || postal)
    const fullAddr = Boolean(a1 && city && state && postal)
    if (anyAddr && !fullAddr) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "partial_address",
        message:
          "Service/billing location requires address line 1, city, state, and postal code — incomplete rows skip location creation.",
      })
      unresolvedRefs.push({
        rowIndex,
        message: "Incomplete address — default service location will not be created for this row.",
      })
    }

    const parentExt = resolveMapped(row, columnMapping, "parent_external_code")
    if (parentExt && !byCode.has(parentExt.toLowerCase())) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "parent_unresolved",
        message:
          "Parent external code is not in Equipify yet — relationship will be noted in customer notes until hierarchy ships.",
      })
    }

    const hasError = issues.some((x) => x.severity === "error")
    const hasWarn = issues.some((x) => x.severity === "warning")
    if (hasError) errorRows += 1
    else if (hasWarn) warningRows += 1
    else okRows += 1

    if (sampleRows.length < 20) {
      const cells: Record<string, string> = {}
      const keys = [
        "company_name",
        "external_code",
        "contact_full_name",
        "contact_email",
        "city",
        "state",
      ] as const
      for (const k of keys) {
        const v = resolveMapped(row, columnMapping, k)
        if (v) cells[k] = v.length > 48 ? `${v.slice(0, 45)}…` : v
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
    summary: {
      errorRows,
      warningRows,
      okRows,
    },
  }
}
