import { GROWTH_SEAMLESS_VENDOR_SCHEMA_VERSION } from "@/lib/growth/import/constants"
import { normalizeEmail, normalizePhone, normalizeWebsiteUrl, trimOrNull } from "@/lib/growth/import/normalize"
import { pickHeader } from "@/lib/growth/import/global-aliases"
import type { GrowthImportColumnMapping, ImportValidationIssue, NormalizedImportRow } from "@/lib/growth/import/types"
import {
  baseNormalizeRow,
  baseValidateRow,
  composeContactName,
  type ImportVendorAdapter,
} from "@/lib/growth/import/vendors/types"

const EMAIL_HEADERS = ["email 1", "email 2", "email 3", "business email", "email", "work email"]
const EMAIL_STATUS_HEADERS = ["email 1 validation status", "email validation status 1", "email 1 status"]
const PHONE_HEADERS = [
  "contact phone 1",
  "contact phone 2",
  "contact phone 3",
  "mobile phone",
  "direct phone",
  "phone",
  "cell",
]
const COMPANY_PHONE_HEADERS = ["company phone 1", "company phone"]
const CONTACT_ID_HEADERS = ["seamless contact id", "contact id", "crm contact id", "crm contact id"]

function readHeaderValue(raw: Record<string, string>, headers: string[]): string | null {
  const match = pickHeader(Object.keys(raw), headers)
  if (!match) return null
  return trimOrNull(raw[match])
}

function pickSeamlessEmail(raw: Record<string, string>): string | null {
  for (const headerSet of [EMAIL_HEADERS]) {
    const match = pickHeader(Object.keys(raw), headerSet)
    if (!match) continue
    const statusHeader = pickHeader(Object.keys(raw), EMAIL_STATUS_HEADERS)
    const status = statusHeader ? raw[statusHeader]?.toLowerCase() ?? "" : ""
    if (status.includes("invalid")) continue
    const email = normalizeEmail(raw[match])
    if (email) return email
  }
  return null
}

function pickSeamlessPhone(raw: Record<string, string>): string | null {
  for (const headerSet of [PHONE_HEADERS, COMPANY_PHONE_HEADERS]) {
    const match = pickHeader(Object.keys(raw), headerSet)
    if (!match) continue
    const phone = normalizePhone(raw[match])
    if (phone) return phone
  }
  return null
}

function pickSeamlessExternalRef(raw: Record<string, string>): string | null {
  const id = readHeaderValue(raw, CONTACT_ID_HEADERS)
  return id
}

function captureSeamlessTierB(raw: Record<string, string>): Record<string, string> {
  const tierBHeaders = [
    "company industry",
    "company employee size",
    "company employee size range",
    "company description",
    "department",
    "seniority",
    "date imported",
    "date researched",
    "lists",
    "lead source",
  ]
  const capture: Record<string, string> = {}
  for (const label of tierBHeaders) {
    const header = pickHeader(Object.keys(raw), [label])
    if (!header) continue
    const value = trimOrNull(raw[header])
    if (value) capture[label.replace(/\s+/g, "_")] = value
  }
  return capture
}

export const seamlessCsvImportAdapter: ImportVendorAdapter = {
  vendorKey() {
    return "seamless"
  },
  vendorName() {
    return "Seamless CSV"
  },
  vendorSchemaVersion() {
    return GROWTH_SEAMLESS_VENDOR_SCHEMA_VERSION
  },
  fieldAliases() {
    return {
      company_name: ["company name", "company", "organization", "account name"],
      first_name: ["first name", "fname"],
      last_name: ["last name", "lname"],
      contact_name: ["full name", "contact name", "name"],
      email: ["email 1", "email 2", "email 3", "business email", "email"],
      phone: ["contact phone 1", "contact phone 2", "mobile phone", "direct phone", "company phone 1"],
      title: ["title", "job title"],
      website: ["website", "company website", "domain"],
      linkedin_url: ["linkedin profile url", "linkedin url", "linkedin"],
      city: ["contact location - city", "city"],
      state: ["contact location - state", "state"],
      postal_code: ["contact location - zip", "zip", "postal code"],
      country: ["contact location - country", "country"],
      address_line1: ["street address", "address"],
      external_ref: ["seamless contact id", "contact id", "crm contact id"],
    }
  },
  normalizeRow(raw, mapping) {
    const row = baseNormalizeRow(raw, mapping)
    const email = row.email ?? pickSeamlessEmail(raw)
    const phone = row.phone ?? pickSeamlessPhone(raw)
    const externalRef = row.externalRef ?? pickSeamlessExternalRef(raw)
    const contactName =
      row.contactName ?? composeContactName({ contactName: null, firstName: row.firstName, lastName: row.lastName })

    return {
      ...row,
      contactName,
      email,
      phone,
      externalRef,
      website: row.website ?? normalizeWebsiteUrl(readHeaderValue(raw, ["website", "company website", "domain"])),
      linkedinUrl: row.linkedinUrl ?? readHeaderValue(raw, ["linkedin profile url", "linkedin url", "linkedin"]),
    }
  },
  validate(row) {
    const issues = baseValidateRow(row)
    if (!row.email && !row.phone) {
      issues.push({
        code: "seamless_no_contact",
        message: "No valid email or phone on row.",
        severity: "warning",
      })
    }
    if (row.phone && !row.email) {
      issues.push({
        code: "seamless_phone_only",
        message: "Phone present without email.",
        severity: "warning",
      })
    }
    return issues
  },
  externalRef(row, vendorKey) {
    if (row.externalRef) return `${vendorKey}:contact:${row.externalRef}`
    const parts = [row.email, row.phone, row.companyName.trim().toLowerCase()].filter(Boolean).join("|")
    if (!parts) return null
    return `${vendorKey}:${parts}`
  },
}

export function extractSeamlessTierBPayload(raw: Record<string, string>): Record<string, string> {
  return captureSeamlessTierB(raw)
}
