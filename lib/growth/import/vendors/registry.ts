import { apolloImportAdapter } from "@/lib/growth/import/vendors/apollo-stub"
import { manualCsvImportAdapter } from "@/lib/growth/import/vendors/manual-csv"
import { seamlessImportAdapter } from "@/lib/growth/import/vendors/seamless-stub"
import type { ImportVendorAdapter } from "@/lib/growth/import/vendors/types"
import { GROWTH_IMPORT_VENDOR_KEYS, type GrowthImportVendorKey } from "@/lib/growth/import/types"

const REGISTRY = new Map<string, ImportVendorAdapter>([
  [manualCsvImportAdapter.vendorKey(), manualCsvImportAdapter],
  [seamlessImportAdapter.vendorKey(), seamlessImportAdapter],
  [apolloImportAdapter.vendorKey(), apolloImportAdapter],
])

export function registerImportVendorAdapter(key: string, adapter: ImportVendorAdapter): void {
  REGISTRY.set(key, adapter)
}

export function getImportVendorAdapter(key: string): ImportVendorAdapter {
  const adapter = REGISTRY.get(key)
  if (!adapter) {
    throw new Error(`unknown_import_vendor:${key}`)
  }
  return adapter
}

export function listImportVendorAdapters(): Array<{
  vendorKey: GrowthImportVendorKey | string
  vendorName: string
  vendorSchemaVersion: string
  fieldAliases: Partial<Record<string, string[]>>
  uiEnabled: boolean
}> {
  return GROWTH_IMPORT_VENDOR_KEYS.map((key) => {
    const adapter = getImportVendorAdapter(key)
    return {
      vendorKey: key,
      vendorName: adapter.vendorName(),
      vendorSchemaVersion: adapter.vendorSchemaVersion(),
      fieldAliases: adapter.fieldAliases(),
      uiEnabled: key === "manual_csv",
    }
  })
}
