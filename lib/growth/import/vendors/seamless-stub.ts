import { GROWTH_IMPORT_VENDOR_SCHEMA_VERSION } from "@/lib/growth/import/constants"
import {
  baseNormalizeRow,
  baseValidateRow,
  buildExternalRef,
  type ImportVendorAdapter,
} from "@/lib/growth/import/vendors/types"

/** Stub adapter — column aliases only; no API integration in 4B.1. */
export const seamlessImportAdapter: ImportVendorAdapter = {
  vendorKey() {
    return "seamless"
  },
  vendorName() {
    return "Seamless.AI"
  },
  vendorSchemaVersion() {
    return GROWTH_IMPORT_VENDOR_SCHEMA_VERSION
  },
  fieldAliases() {
    return {
      company_name: ["company", "company name", "organization"],
      contact_name: ["contact name", "full name", "name"],
      email: ["email", "email address", "business email"],
      phone: ["phone", "mobile phone", "direct phone"],
      title: ["title", "job title"],
      website: ["website", "company website"],
      linkedin_url: ["linkedin", "linkedin url"],
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
