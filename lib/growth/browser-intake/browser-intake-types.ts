/** Browser extension Growth intake — client-safe types. */

import type { NormalizedImportRow } from "@/lib/growth/import/types"
import {
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteUrl,
  trimOrNull,
} from "@/lib/growth/import/normalize"

export const GROWTH_BROWSER_INTAKE_QA_MARKER = "growth-browser-intake-v1" as const

export const GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS = [
  "linkedin",
  "website",
  "manual",
  "other",
] as const

export type GrowthBrowserIntakeSourcePlatform = (typeof GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS)[number]

export type GrowthBrowserIntakeContactInput = {
  company_name: string
  contact_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin_url?: string | null
  source_url?: string | null
  source_platform?: GrowthBrowserIntakeSourcePlatform | string | null
  city?: string | null
  state?: string | null
  notes?: string | null
}

export type GrowthBrowserIntakeWarning = {
  code: string
  message: string
}

export type GrowthBrowserIntakeCaptureMeta = {
  source_kind: "browser_extension"
  source_url: string | null
  source_platform: GrowthBrowserIntakeSourcePlatform
  captured_at: string
  external_ref: string
  notes: string | null
}

export type GrowthBrowserIntakeResult =
  | {
      status: "created"
      lead_id: string
      decision_maker_id: string | null
      warnings: GrowthBrowserIntakeWarning[]
    }
  | {
      status: "updated"
      lead_id: string
      decision_maker_id: string | null
      rule: string
      confidence: number
      warnings: GrowthBrowserIntakeWarning[]
    }
  | {
      status: "suppressed"
      reason: string
      block_layer?: string | null
      warnings: GrowthBrowserIntakeWarning[]
    }
  | {
      status: "error"
      message: string
      warnings: GrowthBrowserIntakeWarning[]
    }

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function splitContactName(fullName: string): { first: string | null; last: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0]!, last: null }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

export function normalizeBrowserIntakeSourcePlatform(
  value: unknown,
): GrowthBrowserIntakeSourcePlatform {
  const raw = asString(value).toLowerCase()
  if (raw === "linkedin") return "linkedin"
  if (raw === "website") return "website"
  if (raw === "manual") return "manual"
  return "other"
}

export function browserIntakeHasContactData(input: GrowthBrowserIntakeContactInput): boolean {
  return Boolean(
    asString(input.contact_name) ||
      normalizeEmail(input.email) ||
      normalizePhone(input.phone) ||
      normalizeLinkedIn(input.linkedin_url),
  )
}

export function browserIntakeInputToImportRow(
  input: GrowthBrowserIntakeContactInput,
  externalRef: string,
): NormalizedImportRow {
  const contactName = asString(input.contact_name)
  const { first, last } = splitContactName(contactName)

  return {
    companyName: asString(input.company_name),
    contactName: contactName || null,
    firstName: first,
    lastName: last,
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    website: normalizeWebsiteUrl(input.website),
    linkedinUrl: trimOrNull(input.linkedin_url),
    title: trimOrNull(input.title),
    addressLine1: null,
    city: trimOrNull(input.city),
    state: trimOrNull(input.state),
    postalCode: null,
    country: "US",
    notes: trimOrNull(input.notes),
    externalRef,
  }
}

export function resolveBrowserIntakeContactName(input: GrowthBrowserIntakeContactInput): string | null {
  const contactName = asString(input.contact_name)
  if (contactName) return contactName

  const email = normalizeEmail(input.email)
  if (email) {
    const local = email.split("@")[0]?.replace(/[._+-]+/g, " ").trim()
    if (local) return local
  }

  if (normalizeLinkedIn(input.linkedin_url)) return "LinkedIn contact"
  if (normalizePhone(input.phone)) return "Phone contact"
  return null
}
