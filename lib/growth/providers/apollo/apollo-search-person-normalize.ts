/** Normalize Apollo /mixed_people/api_search person records — client-safe. */

import type { ApolloPersonRecord, ApolloRedactedRawFieldDiagnostics } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_SEARCH_PERSON_NORMALIZE_QA_MARKER =
  "apollo-search-person-normalize-v1" as const

export type ApolloNameFieldSource = "last_name" | "last_name_obfuscated" | null

export type ApolloSearchPersonNameFields = {
  last_name_source: ApolloNameFieldSource
  available_name_keys: string[]
}

const APOLLO_NAME_FIELD_CANDIDATES = [
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "last_name_obfuscated",
  "lastNameObfuscated",
  "name",
  "full_name",
  "fullName",
] as const

export function unwrapApolloSearchPersonRaw(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {}
  const record = raw as Record<string, unknown>
  const nested =
    record.person && typeof record.person === "object"
      ? (record.person as Record<string, unknown>)
      : null
  if (!nested) return record
  return { ...record, ...nested }
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = asTrimmedString(record[key])
    if (value) return value
  }
  return null
}

export function isApolloObfuscatedLastNameToken(value: string): boolean {
  return /^[A-Za-z]{2}\*+[A-Za-z]$/.test(value.trim())
}

export function listApolloSearchPersonNameKeys(record: Record<string, unknown>): string[] {
  return APOLLO_NAME_FIELD_CANDIDATES.filter((key) => Boolean(asTrimmedString(record[key])))
}

function resolveApolloSearchLastName(record: Record<string, unknown>): {
  last_name: string | null
  last_name_obfuscated: string | null
  last_name_source: ApolloNameFieldSource
} {
  const last_name_obfuscated = pickString(record, ["last_name_obfuscated", "lastNameObfuscated"])
  const plain_last_name = pickString(record, ["last_name", "lastName"])

  if (last_name_obfuscated) {
    const resolvedLastName =
      plain_last_name && !isApolloObfuscatedLastNameToken(plain_last_name)
        ? plain_last_name
        : last_name_obfuscated
    return {
      last_name: resolvedLastName,
      last_name_obfuscated,
      last_name_source:
        plain_last_name && !isApolloObfuscatedLastNameToken(plain_last_name)
          ? "last_name"
          : "last_name_obfuscated",
    }
  }

  if (plain_last_name && isApolloObfuscatedLastNameToken(plain_last_name)) {
    return {
      last_name: plain_last_name,
      last_name_obfuscated: plain_last_name,
      last_name_source: "last_name_obfuscated",
    }
  }

  if (plain_last_name) {
    return {
      last_name: plain_last_name,
      last_name_obfuscated: null,
      last_name_source: "last_name",
    }
  }

  return {
    last_name: null,
    last_name_obfuscated: null,
    last_name_source: null,
  }
}

export function buildApolloRedactedRawFieldDiagnostics(input: {
  raw: Record<string, unknown>
  person: ApolloPersonRecord
}): ApolloRedactedRawFieldDiagnostics {
  const org =
    input.raw.organization && typeof input.raw.organization === "object"
      ? (input.raw.organization as Record<string, unknown>)
      : input.person.organization

  const first_name = pickString(input.raw, ["first_name", "firstName"])
  const resolvedLast = resolveApolloSearchLastName(input.raw)
  const last_name = resolvedLast.last_name_source === "last_name" ? resolvedLast.last_name : null
  const last_name_obfuscated = resolvedLast.last_name_obfuscated
  const name = pickString(input.raw, ["name", "full_name", "fullName"])
  const resolvedFullName =
    name ??
    (first_name && resolvedLast.last_name
      ? `${first_name} ${resolvedLast.last_name}`
      : first_name ?? resolvedLast.last_name)

  return {
    available_name_keys: listApolloSearchPersonNameKeys(input.raw),
    available_person_keys: Object.keys(input.raw)
      .filter((key) => !key.startsWith("_"))
      .sort(),
    first_name_present: Boolean(first_name),
    last_name_present: Boolean(last_name),
    name_present: Boolean(name),
    full_name_present: Boolean(resolvedFullName && resolvedFullName.length >= 2),
    person_id_present: Boolean(pickString(input.raw, ["id"])),
    last_name_obfuscated_present: Boolean(last_name_obfuscated),
    title: pickString(input.raw, ["title", "headline"]) ?? asTrimmedString(input.person.title),
    organization_domain:
      (org && typeof org === "object"
        ? pickString(org as Record<string, unknown>, ["primary_domain", "domain"])
        : null) ?? null,
  }
}

export function normalizeApolloSearchPersonRecord(raw: unknown): ApolloPersonRecord {
  const record = unwrapApolloSearchPersonRaw(raw)

  const first_name = pickString(record, ["first_name", "firstName"])
  const {
    last_name: resolvedLastName,
    last_name_obfuscated,
    last_name_source,
  } = resolveApolloSearchLastName(record)

  const explicitName = pickString(record, ["name", "full_name", "fullName"])
  const name =
    explicitName ??
    (first_name && resolvedLastName ? `${first_name} ${resolvedLastName}` : first_name ?? resolvedLastName)

  const organization =
    record.organization && typeof record.organization === "object"
      ? (record.organization as ApolloPersonRecord["organization"])
      : null

  const person: ApolloPersonRecord = {
    id: pickString(record, ["id"]),
    first_name,
    last_name: resolvedLastName,
    last_name_obfuscated,
    name,
    title: pickString(record, ["title", "headline"]),
    headline: pickString(record, ["headline"]),
    linkedin_url: pickString(record, ["linkedin_url", "linkedinUrl"]),
    email: pickString(record, ["email"]),
    email_status: pickString(record, ["email_status", "emailStatus"]),
    extrapolated_email_confidence:
      typeof record.extrapolated_email_confidence === "number"
        ? record.extrapolated_email_confidence
        : typeof record.extrapolatedEmailConfidence === "number"
          ? record.extrapolatedEmailConfidence
          : null,
    sanitized_phone: pickString(record, ["sanitized_phone", "sanitizedPhone"]),
    phone_numbers: Array.isArray(record.phone_numbers)
      ? (record.phone_numbers as ApolloPersonRecord["phone_numbers"])
      : Array.isArray(record.phoneNumbers)
        ? (record.phoneNumbers as ApolloPersonRecord["phone_numbers"])
        : null,
    seniority: pickString(record, ["seniority"]),
    departments: Array.isArray(record.departments) ? (record.departments as string[]) : null,
    functions: Array.isArray(record.functions) ? (record.functions as string[]) : null,
    organization,
    organization_id: pickString(record, ["organization_id", "organizationId"]),
    city: pickString(record, ["city"]),
    state: pickString(record, ["state"]),
    country: pickString(record, ["country"]),
    has_email: record.has_email === true || record.hasEmail === true ? true : null,
    has_direct_phone:
      record.has_direct_phone === true ||
      record.hasDirectPhone === true ||
      record.has_direct_phone === "Yes"
        ? true
        : null,
    apollo_name_fields: {
      last_name_source,
      available_name_keys: listApolloSearchPersonNameKeys(record),
    },
  }

  person.apollo_search_field_diagnostics = buildApolloRedactedRawFieldDiagnostics({
    raw: record,
    person,
  })

  return person
}

export function normalizeApolloSearchPeople(rawPeople: unknown[]): ApolloPersonRecord[] {
  if (!Array.isArray(rawPeople)) return []
  return rawPeople.map(normalizeApolloSearchPersonRecord)
}
