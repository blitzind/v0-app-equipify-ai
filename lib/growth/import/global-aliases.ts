import type { GrowthImportCanonicalField } from "@/lib/growth/import/types"

export const GROWTH_IMPORT_GLOBAL_ALIASES: Record<GrowthImportCanonicalField, string[]> = {
  company_name: [
    "company name",
    "company",
    "account name",
    "organization",
    "account",
    "business name",
  ],
  first_name: ["first name", "contact first name", "first", "fname"],
  last_name: ["last name", "contact last name", "last", "lname"],
  contact_name: ["full name", "contact name", "name", "contact"],
  email: ["email", "email 1", "business email", "work email", "e-mail"],
  phone: ["phone", "contact phone 1", "mobile", "cell", "phone number", "direct phone"],
  website: ["website", "domain", "url", "company website", "web"],
  linkedin_url: ["linkedin", "linkedin url", "profile url", "linkedin profile"],
  title: ["title", "job title", "role", "position"],
  address_line1: ["address", "address line 1", "street", "street address"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  postal_code: ["postal code", "zip", "zip code", "postcode"],
  country: ["country", "nation"],
  notes: ["notes", "comments", "description"],
  external_ref: ["external ref", "external id", "record id", "source id", "id"],
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
}

export function pickHeader(headers: string[], aliases: string[]): string | undefined {
  const aliasNorms = new Set(aliases.map(normalizeHeader))
  for (const header of headers) {
    if (aliasNorms.has(normalizeHeader(header))) return header
  }
  for (const header of headers) {
    const hn = normalizeHeader(header)
    for (const alias of aliases) {
      if (hn.includes(normalizeHeader(alias)) || normalizeHeader(alias).includes(hn)) {
        return header
      }
    }
  }
  return undefined
}
