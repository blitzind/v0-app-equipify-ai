/** Browser extension Growth intake — client-safe types. */

import type { NormalizedImportRow } from "@/lib/growth/import/types"
import {
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteUrl,
  trimOrNull,
} from "@/lib/growth/import/normalize"

export const GROWTH_BROWSER_INTAKE_QA_MARKER = "growth-browser-intake-v2" as const

export const GROWTH_BROWSER_INTAKE_CAPTURE_METHODS = ["chrome_extension"] as const

export type GrowthBrowserIntakeCaptureMethod = (typeof GROWTH_BROWSER_INTAKE_CAPTURE_METHODS)[number]

export const GROWTH_BROWSER_INTAKE_MODES = ["default", "update_existing", "create_new"] as const

export type GrowthBrowserIntakeMode = (typeof GROWTH_BROWSER_INTAKE_MODES)[number]

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
  page_title?: string | null
  capture_method?: GrowthBrowserIntakeCaptureMethod | string | null
  company_only?: boolean
  queue_contact_discovery?: boolean
  verify_email?: boolean
  intake_mode?: GrowthBrowserIntakeMode
  target_lead_id?: string | null
}

export type GrowthBrowserIntakeServiceInput = GrowthBrowserIntakeContactInput & {
  created_by?: string | null
  actor_email?: string | null
}

export type GrowthBrowserIntakeWarning = {
  code: string
  message: string
}

export type GrowthBrowserIntakeCaptureMeta = {
  source_kind: "browser_extension"
  source_url: string | null
  source_platform: GrowthBrowserIntakeSourcePlatform
  page_title: string | null
  captured_at: string
  capture_method: GrowthBrowserIntakeCaptureMethod
  external_ref: string
  notes: string | null
  linkedin_url?: string | null
  capture_type?: "company_only" | "contact"
}

export type GrowthBrowserIntakeResultBase = {
  warnings: GrowthBrowserIntakeWarning[]
  contact_discovery_queued?: boolean
  company_candidate_id?: string | null
  capture_type?: "company_only" | "contact"
  email_status?: string | null
  verified_by_provider?: boolean
}

export type GrowthBrowserIntakeResult =
  | ({
      status: "created"
      lead_id: string
      decision_maker_id: string | null
    } & GrowthBrowserIntakeResultBase)
  | ({
      status: "updated"
      lead_id: string
      decision_maker_id: string | null
      rule: string
      confidence: number
    } & GrowthBrowserIntakeResultBase)
  | ({
      status: "suppressed"
      reason: string
      block_layer?: string | null
    } & GrowthBrowserIntakeResultBase)
  | ({
      status: "error"
      message: string
    } & GrowthBrowserIntakeResultBase)

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

export function browserIntakeIsCompanyOnlyCapture(input: GrowthBrowserIntakeContactInput): boolean {
  if (input.company_only === true) return true
  return !browserIntakeHasContactData(input)
}

export function normalizeBrowserIntakeCaptureMethod(
  value: unknown,
): GrowthBrowserIntakeCaptureMethod {
  return asString(value) === "chrome_extension" ? "chrome_extension" : "chrome_extension"
}
