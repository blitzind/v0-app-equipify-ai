/** Manual operator contact entry — client-safe types. */

import type { NormalizedImportRow } from "@/lib/growth/import/types"

export const GROWTH_MANUAL_CONTACT_ENTRY_QA_MARKER = "growth-manual-contact-entry-v1" as const

export type GrowthManualContactEntryInput = {
  company_name: string
  contact_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin_url?: string | null
  city?: string | null
  state?: string | null
  source_note?: string | null
  /** When true and email present, run ZeroBounce (or configured provider) before create. */
  verify_email?: boolean
  acquisition_run_id?: string | null
}

export type GrowthManualContactEntryWarning = {
  code: string
  message: string
}

export type GrowthManualContactEntryResult =
  | {
      status: "created"
      lead_id: string
      decision_maker_id: string
      email_status: string | null
      verified_by_provider: boolean
      warnings: GrowthManualContactEntryWarning[]
    }
  | {
      status: "linked_duplicate"
      lead_id: string
      rule: string
      confidence: number
      warnings: GrowthManualContactEntryWarning[]
    }
  | {
      status: "suppressed"
      reason: string
      block_layer?: string | null
      warnings: GrowthManualContactEntryWarning[]
    }
  | {
      status: "error"
      message: string
      warnings: GrowthManualContactEntryWarning[]
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

export function manualContactInputToImportRow(
  input: GrowthManualContactEntryInput,
  externalRef: string,
): NormalizedImportRow {
  const contactName = asString(input.contact_name)
  const { first, last } = splitContactName(contactName)

  return {
    companyName: asString(input.company_name),
    contactName: contactName || null,
    firstName: first,
    lastName: last,
    email: asString(input.email) || null,
    phone: asString(input.phone) || null,
    website: asString(input.website) || null,
    linkedinUrl: asString(input.linkedin_url) || null,
    title: asString(input.title) || null,
    addressLine1: null,
    city: asString(input.city) || null,
    state: asString(input.state) || null,
    postalCode: null,
    country: "US",
    notes: asString(input.source_note) || null,
    externalRef,
  }
}
