/**
 * GE-LAUNCH-1A — Canonical lead intake normalization.
 * Client-safe. All sources normalize into the same internal shape.
 */

import {
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteDomain,
} from "@/lib/growth/import/normalize"
import {
  isConsumerEmailDomain,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import {
  GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
  LEAD_INTAKE_SOURCES,
  type LeadIntakeSource,
  type NormalizedLeadIntake,
  type UnifiedLeadIntakeRequest,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isLeadIntakeSource(value: string): value is LeadIntakeSource {
  return (LEAD_INTAKE_SOURCES as readonly string[]).includes(value)
}

function resolveContactName(input: UnifiedLeadIntakeRequest): {
  contactName: string | null
  firstName: string | null
  lastName: string | null
} {
  const explicit = asString(input.contact?.name)
  if (explicit) {
    const parts = explicit.split(/\s+/).filter(Boolean)
    return {
      contactName: explicit,
      firstName: asString(input.contact?.firstName) || parts[0] || null,
      lastName: asString(input.contact?.lastName) || (parts.length > 1 ? parts.slice(1).join(" ") : null),
    }
  }

  const firstName = asString(input.contact?.firstName)
  const lastName = asString(input.contact?.lastName)
  if (firstName || lastName) {
    const contactName = [firstName, lastName].filter(Boolean).join(" ")
    return { contactName: contactName || null, firstName: firstName || null, lastName: lastName || null }
  }

  return { contactName: null, firstName: null, lastName: null }
}

function domainFromWebsite(website: string | null, domain: string | null): string | null {
  const explicit = asString(domain)
  if (explicit) return normalizeWebsiteDomain(explicit)

  const site = asString(website)
  if (!site) return null

  try {
    const url = site.startsWith("http") ? new URL(site) : new URL(`https://${site}`)
    return normalizeWebsiteDomain(url.hostname)
  } catch {
    return normalizeWebsiteDomain(site.split("/")[0] ?? site)
  }
}

function buildImportRow(intake: {
  companyName: string
  contactName: string | null
  firstName: string | null
  lastName: string | null
  title: string | null
  email: string | null
  phone: string | null
  website: string | null
  linkedinUrl: string | null
  externalRef: string | null
}): NormalizedImportRow {
  return {
    companyName: intake.companyName,
    contactName: intake.contactName,
    firstName: intake.firstName,
    lastName: intake.lastName,
    title: intake.title,
    email: intake.email,
    phone: intake.phone,
    website: intake.website,
    linkedinUrl: intake.linkedinUrl,
    externalRef: intake.externalRef,
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    notes: null,
  }
}

function sourceRequiresContact(source: LeadIntakeSource): boolean {
  return source === "manual" || source === "csv_import"
}

function sourceAllowsCompanyOnly(source: LeadIntakeSource): boolean {
  return source === "linkedin_capture" || source === "browser_intake" || source === "website"
}

export function normalizeLeadIntakeSource(input: UnifiedLeadIntakeRequest): NormalizedLeadIntake {
  const warnings: string[] = []
  const blockers: string[] = []

  const rawSource = asString(input.source).toLowerCase()
  const source: LeadIntakeSource = isLeadIntakeSource(rawSource) ? rawSource : "manual"
  if (!isLeadIntakeSource(rawSource)) {
    warnings.push(`Unknown source "${rawSource}" — treated as manual.`)
  }

  const companyName = normalizeCompanyName(asString(input.company?.name))
  if (!companyName) {
    blockers.push("company_name_required")
  }

  const website = asString(input.company?.website) || null
  let domain = domainFromWebsite(website, asString(input.company?.domain) || null)
  let resolvedWebsite = website

  if (domain && isConsumerEmailDomain(domain)) {
    warnings.push("consumer_domain_not_used_as_company_website")
    domain = null
    resolvedWebsite = null
  }
  if (companyName && isConsumerEmailDomain(normalizeDomain(companyName))) {
    warnings.push("company_name_matches_consumer_domain")
  }
  const industry = asString(input.company?.industry) || null
  const companyId = asString(input.company?.companyId) || null

  const { contactName, firstName, lastName } = resolveContactName(input)
  const title = asString(input.contact?.title) || null
  const email = normalizeEmail(asString(input.contact?.email)) || null
  const phone = normalizePhone(asString(input.contact?.phone)) || null
  const linkedinUrl = normalizeLinkedIn(asString(input.contact?.linkedinUrl)) || null
  const personId = asString(input.contact?.personId) || asString(input.contact?.contactId) || null
  const contactId = asString(input.contact?.contactId) || personId

  const leadId = asString(input.metadata?.leadId) || null
  const externalRef = asString(input.metadata?.externalRef) || null

  const identityUncertain =
    input.metadata?.identityUncertain === true ||
    ((source === "linkedin_capture" || source === "browser_intake") &&
      !companyName &&
      !domain &&
      !email)

  if (!email) {
    warnings.push("missing_email_routes_to_verification")
  }
  if (!domain && !website) {
    warnings.push("missing_company_domain_routes_to_research")
  }
  if (sourceRequiresContact(source) && !contactName) {
    blockers.push("contact_name_required")
  }
  if (sourceAllowsCompanyOnly(source) && !contactName && !email && !phone) {
    warnings.push("company_only_capture_requires_contact_discovery")
  }
  if (identityUncertain) {
    warnings.push("identity_uncertain_mark_for_human_review")
  }

  const requiresHumanReview =
    identityUncertain ||
    input.metadata?.identityUncertain === true ||
    blockers.length > 0

  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    normalized_source: source,
  }

  const importRow = companyName
    ? buildImportRow({
        companyName,
        contactName,
        firstName,
        lastName,
        title,
        email,
        phone,
        website: resolvedWebsite,
        linkedinUrl,
        externalRef,
      })
    : null

  return {
    qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
    source,
    companyName: companyName || "",
    website: resolvedWebsite,
    domain,
    industry,
    companyId,
    contactName,
    contactFirstName: firstName,
    contactLastName: lastName,
    title,
    email,
    phone,
    linkedinUrl,
    personId,
    contactId,
    leadId,
    externalRef,
    identityUncertain,
    requiresHumanReview,
    warnings,
    blockers,
    metadata,
    importRow,
  }
}
