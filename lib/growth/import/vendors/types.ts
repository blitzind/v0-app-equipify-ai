import type {
  GrowthImportCanonicalField,
  GrowthImportColumnMapping,
  ImportValidationIssue,
  NormalizedImportRow,
} from "@/lib/growth/import/types"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsiteUrl,
  trimOrNull,
} from "@/lib/growth/import/normalize"
import { resolveMappedValue } from "@/lib/growth/import/map-columns"

export interface ImportVendorAdapter {
  vendorKey(): string
  vendorName(): string
  vendorSchemaVersion(): string
  fieldAliases(): Partial<Record<GrowthImportCanonicalField, string[]>>
  normalizeRow(raw: Record<string, string>, mapping: GrowthImportColumnMapping): NormalizedImportRow
  validate(row: NormalizedImportRow): ImportValidationIssue[]
  externalRef(row: NormalizedImportRow, vendorKey: string): string | null
}

export function composeContactName(row: Pick<NormalizedImportRow, "contactName" | "firstName" | "lastName">): string | null {
  if (row.contactName) return row.contactName
  const parts = [row.firstName, row.lastName].filter(Boolean)
  return parts.length ? parts.join(" ") : null
}

export function baseNormalizeRow(
  raw: Record<string, string>,
  mapping: GrowthImportColumnMapping,
): NormalizedImportRow {
  const firstName = trimOrNull(resolveMappedValue(raw, mapping, "first_name"))
  const lastName = trimOrNull(resolveMappedValue(raw, mapping, "last_name"))
  const contactName =
    trimOrNull(resolveMappedValue(raw, mapping, "contact_name")) ??
    composeContactName({ contactName: null, firstName, lastName })

  return {
    companyName: trimOrNull(resolveMappedValue(raw, mapping, "company_name")) ?? "",
    contactName,
    firstName,
    lastName,
    email: normalizeEmail(resolveMappedValue(raw, mapping, "email")),
    phone: normalizePhone(resolveMappedValue(raw, mapping, "phone")),
    website: normalizeWebsiteUrl(resolveMappedValue(raw, mapping, "website")),
    linkedinUrl: trimOrNull(resolveMappedValue(raw, mapping, "linkedin_url")),
    title: trimOrNull(resolveMappedValue(raw, mapping, "title")),
    addressLine1: trimOrNull(resolveMappedValue(raw, mapping, "address_line1")),
    city: trimOrNull(resolveMappedValue(raw, mapping, "city")),
    state: trimOrNull(resolveMappedValue(raw, mapping, "state")),
    postalCode: trimOrNull(resolveMappedValue(raw, mapping, "postal_code")),
    country: trimOrNull(resolveMappedValue(raw, mapping, "country")) ?? "US",
    notes: trimOrNull(resolveMappedValue(raw, mapping, "notes")),
    externalRef: trimOrNull(resolveMappedValue(raw, mapping, "external_ref")),
  }
}

export function baseValidateRow(row: NormalizedImportRow): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = []
  if (!row.companyName.trim()) {
    issues.push({ code: "missing_company", message: "Company name is required.", severity: "error" })
  }
  return issues
}

export function buildExternalRef(row: NormalizedImportRow, vendorKey: string): string | null {
  if (row.externalRef) return `${vendorKey}:${row.externalRef}`
  const parts = [row.email, row.phone, normalizeCompanyName(row.companyName), normalizeWebsiteDomain(row.website)]
    .filter(Boolean)
    .join("|")
  if (!parts) return null
  return `${vendorKey}:${parts}`
}

function normalizeWebsiteDomain(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`)
    let host = url.hostname.toLowerCase()
    if (host.startsWith("www.")) host = host.slice(4)
    return host
  } catch {
    return null
  }
}
