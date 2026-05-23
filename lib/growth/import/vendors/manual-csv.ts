import { GROWTH_IMPORT_VENDOR_SCHEMA_VERSION } from "@/lib/growth/import/constants"
import {
  baseNormalizeRow,
  baseValidateRow,
  buildExternalRef,
  type ImportVendorAdapter,
} from "@/lib/growth/import/vendors/types"

export const manualCsvImportAdapter: ImportVendorAdapter = {
  vendorKey() {
    return "manual_csv"
  },
  vendorName() {
    return "Manual CSV"
  },
  vendorSchemaVersion() {
    return GROWTH_IMPORT_VENDOR_SCHEMA_VERSION
  },
  fieldAliases() {
    return {}
  },
  normalizeRow(raw, mapping) {
    return baseNormalizeRow(raw, mapping)
  },
  validate(row) {
    return baseValidateRow(row)
  },
  externalRef(row, vendorKey) {
    return buildExternalRef(row, vendorKey)
  },
}
