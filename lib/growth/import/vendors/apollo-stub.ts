import { GROWTH_IMPORT_VENDOR_SCHEMA_VERSION } from "@/lib/growth/import/constants"
import {
  baseNormalizeRow,
  baseValidateRow,
  buildExternalRef,
  type ImportVendorAdapter,
} from "@/lib/growth/import/vendors/types"

/** Stub adapter — column aliases only; no API integration in 4B.1. */
export const apolloImportAdapter: ImportVendorAdapter = {
  vendorKey() {
    return "apollo"
  },
  vendorName() {
    return "Apollo"
  },
  vendorSchemaVersion() {
    return GROWTH_IMPORT_VENDOR_SCHEMA_VERSION
  },
  fieldAliases() {
    return {
      company_name: ["account name", "company", "organization name"],
      first_name: ["first name"],
      last_name: ["last name"],
      email: ["email", "primary email"],
      phone: ["phone", "mobile phone", "corporate phone"],
      title: ["title"],
      website: ["website", "company domain"],
      linkedin_url: ["person linkedin url", "linkedin url"],
      city: ["city"],
      state: ["state"],
      country: ["country"],
    }
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
