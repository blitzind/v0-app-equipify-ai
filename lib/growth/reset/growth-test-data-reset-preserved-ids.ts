/**
 * Validates golden fixture IDs used for Growth reset preservation filters.
 */

const GROWTH_RESET_PRESERVED_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isGrowthResetPreservedUuid(value: unknown): value is string {
  return typeof value === "string" && GROWTH_RESET_PRESERVED_UUID_RE.test(value.trim())
}

export type GrowthResetPreservedIdSanitizeResult = {
  valid: string[]
  invalid: string[]
  warnings: string[]
}

function uniqueValidUuids(values: string[]): string[] {
  const seen = new Set<string>()
  const valid: string[] = []
  for (const value of values) {
    if (!isGrowthResetPreservedUuid(value)) continue
    const id = value.trim()
    if (seen.has(id)) continue
    seen.add(id)
    valid.push(id)
  }
  return valid
}

export function sanitizeGrowthResetPreservedIds(
  label: string,
  values: string[],
): GrowthResetPreservedIdSanitizeResult {
  const valid = uniqueValidUuids(values)
  const invalid = values
    .map((value) => (typeof value === "string" ? value.trim() : String(value ?? "")))
    .filter((value) => value.length > 0 && !isGrowthResetPreservedUuid(value))

  const warnings: string[] = []
  if (values.length > 0 && valid.length === 0) {
    warnings.push(`${label}_skipped_no_valid_ids`)
  } else if (invalid.length > 0) {
    warnings.push(`${label}_invalid_ids_ignored:${invalid.length}`)
  }

  return { valid, invalid, warnings }
}

export function sanitizeGrowthResetPreservedFkValues(
  fkColumn: string,
  values: string[],
): GrowthResetPreservedIdSanitizeResult {
  return sanitizeGrowthResetPreservedIds(`preserved_fk_${fkColumn}`, values)
}

export function describeGrowthResetPreservedFkFilter(
  fkColumn: string,
  validCount: number,
): string {
  return `${fkColumn}.in(${validCount} uuid)`
}

export function mergeGrowthResetAuditNotes(
  notes: string | null,
  warnings: string[],
): string | null {
  if (warnings.length === 0) return notes
  const warningText = warnings.join("; ")
  return notes ? `${notes}; ${warningText}` : warningText
}
