import { GROWTH_IMPORT_GLOBAL_ALIASES, pickHeader } from "@/lib/growth/import/global-aliases"
import type { GrowthImportColumnMapping, GrowthImportCanonicalField } from "@/lib/growth/import/types"
import type { ImportVendorAdapter } from "@/lib/growth/import/vendors/types"

export function suggestGrowthImportColumnMapping(
  headers: string[],
  adapter: ImportVendorAdapter,
): GrowthImportColumnMapping {
  const mapping: GrowthImportColumnMapping = {}
  const adapterAliases = adapter.fieldAliases()

  for (const field of Object.keys(GROWTH_IMPORT_GLOBAL_ALIASES) as GrowthImportCanonicalField[]) {
    const aliases = [...(adapterAliases[field] ?? []), ...(GROWTH_IMPORT_GLOBAL_ALIASES[field] ?? [])]
    const header = pickHeader(headers, aliases)
    if (header) mapping[field] = header
  }

  return mapping
}

export function resolveMappedValue(
  rawRow: Record<string, string>,
  mapping: GrowthImportColumnMapping,
  field: GrowthImportCanonicalField,
): string {
  const header = mapping[field]
  if (!header) return ""
  return (rawRow[header] ?? "").trim()
}
