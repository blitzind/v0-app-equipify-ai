import type { StoredPriceListPayload } from "@/lib/catalog/import-types"

/** Typical manufacturer / brand names are short; long prose belongs in description. */
export const CATALOG_IMPORT_MANUFACTURER_MAX_LENGTH = 80

export type CatalogImportManufacturerContext = {
  /** Row description values from the import (for cross-check). */
  descriptionValues?: Iterable<string | null | undefined>
  /** Row name values when names were copied from description. */
  nameValues?: Iterable<string | null | undefined>
  /** Raw values observed in the mapped manufacturer column. */
  manufacturerColumnValues?: Iterable<string | null | undefined>
}

export type SanitizedCatalogImportManufacturer = {
  value: string | null
  warning: string | null
  rejectedReason: "empty" | "too_long" | "description_like" | "matches_description" | "matches_name" | null
}

function collectTrimmed(values: Iterable<string | null | undefined> | undefined): Set<string> {
  const out = new Set<string>()
  if (!values) return out
  for (const raw of values) {
    const t = raw?.trim()
    if (t) out.add(t)
  }
  return out
}

/** True when text looks like a sentence / paragraph rather than a brand name. */
export function isDescriptionLikeManufacturerCandidate(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.includes("\n") || t.includes("\r")) return true
  if (t.length > CATALOG_IMPORT_MANUFACTURER_MAX_LENGTH) return true
  if (t.length > 48 && /[.!?]/.test(t)) return true
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 10) return true
  return false
}

export function sanitizeCatalogImportManufacturerName(
  raw: string | null | undefined,
  context: CatalogImportManufacturerContext = {},
): SanitizedCatalogImportManufacturer {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) {
    return { value: null, warning: null, rejectedReason: "empty" }
  }

  const descriptions = collectTrimmed(context.descriptionValues)
  const names = collectTrimmed(context.nameValues)

  if (descriptions.has(trimmed)) {
    return {
      value: null,
      warning:
        "Manufacturer was left blank because the detected value matched an item description. Map manufacturer to a Manufacturer / Brand column, not Description.",
      rejectedReason: "matches_description",
    }
  }

  if (names.has(trimmed) && isDescriptionLikeManufacturerCandidate(trimmed)) {
    return {
      value: null,
      warning:
        "Manufacturer was left blank because the detected value matched a long item name/description. Verify your Manufacturer column mapping.",
      rejectedReason: "matches_name",
    }
  }

  if (isDescriptionLikeManufacturerCandidate(trimmed)) {
    return {
      value: null,
      warning:
        "Manufacturer was left blank because the detected value looks like a description (too long or sentence-like). Use a short brand name in the Manufacturer column.",
      rejectedReason: "description_like",
    }
  }

  if (trimmed.length > CATALOG_IMPORT_MANUFACTURER_MAX_LENGTH) {
    return {
      value: null,
      warning: "Manufacturer was left blank because the detected value exceeded the maximum length for a brand name.",
      rejectedReason: "too_long",
    }
  }

  return { value: trimmed, warning: null, rejectedReason: null }
}

/**
 * Infer document-level manufacturer from a dedicated manufacturer column.
 * Skips description-like cell values and never reads from description/notes columns.
 */
export function inferCatalogImportManufacturerFromColumn(args: {
  rows: Record<string, string>[]
  manufacturerColumn?: string
  descriptionColumn?: string
  notesColumn?: string
  cell: (row: Record<string, string>, header: string | undefined) => string
}): SanitizedCatalogImportManufacturer {
  const { rows, manufacturerColumn, descriptionColumn, notesColumn, cell } = args
  if (!manufacturerColumn) {
    return { value: null, warning: null, rejectedReason: "empty" }
  }
  if (
    manufacturerColumn === descriptionColumn ||
    manufacturerColumn === notesColumn
  ) {
    return {
      value: null,
      warning:
        "Manufacturer column overlapped with Description or Notes — manufacturer was left blank. Use separate columns.",
      rejectedReason: "description_like",
    }
  }

  const descriptionValues = new Set<string>()
  const nameLikeValues = new Set<string>()
  for (const row of rows) {
    const d = cell(row, descriptionColumn)
    if (d) descriptionValues.add(d)
    const n = cell(row, manufacturerColumn)
    if (n && isDescriptionLikeManufacturerCandidate(n)) {
      nameLikeValues.add(n)
    }
  }

  const counts = new Map<string, number>()
  for (const row of rows) {
    const v = cell(row, manufacturerColumn)
    if (!v) continue
    const sanitized = sanitizeCatalogImportManufacturerName(v, {
      descriptionValues,
      nameValues: nameLikeValues,
    })
    if (!sanitized.value) continue
    counts.set(sanitized.value, (counts.get(sanitized.value) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return {
      value: null,
      warning:
        "No usable manufacturer values were found in the Manufacturer column (values looked like descriptions or were empty).",
      rejectedReason: "description_like",
    }
  }

  let best = ""
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }

  return sanitizeCatalogImportManufacturerName(best, { descriptionValues })
}

function manufacturerContextFromPayload(payload: StoredPriceListPayload): CatalogImportManufacturerContext {
  return {
    descriptionValues: payload.rows.map((r) => r.description),
    nameValues: payload.rows.map((r) => r.name),
  }
}

/** Single normalization path for preview, PATCH save, commit, and re-extract. */
export function normalizeCatalogImportPayload(payload: StoredPriceListPayload): StoredPriceListPayload {
  const context = manufacturerContextFromPayload(payload)
  const sanitized = sanitizeCatalogImportManufacturerName(payload.manufacturerName, context)

  const warnings = [...payload.warnings]
  if (sanitized.warning && !warnings.includes(sanitized.warning)) {
    warnings.push(sanitized.warning)
  }

  return {
    ...payload,
    manufacturerName: sanitized.value,
    warnings,
  }
}
