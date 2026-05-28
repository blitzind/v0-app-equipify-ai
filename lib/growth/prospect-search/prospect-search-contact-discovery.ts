/** Prospect Search contact discovery UX — coverage, people rows, provider honesty. Client-safe. */

import { formatWebsiteExtractEvidenceLabel } from "@/lib/growth/contact-discovery/website-extract-mapper"
import {
  resolveContactOutreachEligibilityBundle,
  type ProspectSearchContactEligibilityState,
} from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  formatProspectSearchContactSourceLabel,
  computeProspectSearchContactOutreachReadiness,
} from "@/lib/growth/prospect-search/prospect-search-contact-readiness"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER =
  "growth-prospect-contact-discovery-v1" as const

export { GROWTH_PEOPLE_HYDRATION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-readiness"
export { GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER } from "@/lib/growth/contact-discovery/website-extract-mapper"
export { GROWTH_PEOPLE_WORKFLOWS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-people-selection"
export { GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"

export type ProspectSearchResultMode = "companies" | "people"

export type ProspectSearchContactCoverageStatus =
  | "no_contacts_found"
  | "website_extraction_pending"
  | "contact_research_needed"
  | "contacts_found"
  | "email_available"
  | "phone_available"
  | "needs_verification"
  | "blocked_suppressed"

export type ProspectSearchContactProviderState =
  | "connected"
  | "internal_sources"
  | "website_crawl"
  | "no_provider_connected"

export type GrowthProspectSearchPeopleResultRow = GrowthProspectSearchPersonResult & {
  company: GrowthProspectSearchCompanyResult
  contact_id: string
  email_reason: string | null
  phone_reason: string | null
  source_label: string | null
  source_page_url: string | null
  confidence: number
  location: string | null
  compliance_status: "ready" | "suppressed" | "review_required"
  last_checked_at: string | null
  outreach_ready: boolean
  email_available: boolean
  phone_available: boolean
  call_ready: boolean
  sms_ready: boolean
  readiness_label: string
  email_eligibility: ProspectSearchContactEligibilityState
  call_eligibility: ProspectSearchContactEligibilityState
  sms_eligibility: ProspectSearchContactEligibilityState
  call_block_reason: string | null
  sms_block_reason: string | null
  phone_on_dnc: boolean | null
  timeline_events: ProspectSearchPeopleTimelineEvent[]
}

export type ProspectSearchPeopleTimelineEvent = {
  id: string
  kind: "discovered" | "verified" | "refreshed" | "routed_queue" | "added_pipeline" | "suppressed"
  label: string
  detail: string
  occurred_at: string | null
}

export function hasProspectSearchDecisionMakerFilters(
  filters: GrowthProspectSearchFilters,
): boolean {
  return Boolean(
    filters.title_contains?.trim() ||
      filters.decision_maker_role?.trim() ||
      (filters.title_hints?.length ?? 0) > 0,
  )
}

export function resolveProspectSearchContactProviderState(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchContactProviderState {
  const labels = company.contact_intelligence?.source_labels ?? []
  if (
    labels.some(
      (label) =>
        label.includes("website_public_extract") || label.includes("growth.company_contacts"),
    )
  ) {
    return "website_crawl"
  }
  if (labels.some((label) => label.includes("contact_discovery"))) return "connected"
  if (labels.some((label) => label.includes("lead_decision_makers") || label.includes("lead_engine"))) {
    return "internal_sources"
  }
  if (company.source_type === "external_discovered") return "no_provider_connected"
  if (company.growth_lead_id) return "internal_sources"
  return "no_provider_connected"
}

export function resolveProspectSearchContactCoverageStatus(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchContactCoverageStatus {
  if (company.is_suppressed) return "blocked_suppressed"

  const labels = company.contact_intelligence?.source_labels ?? []
  const intelligence = company.contact_intelligence
  const contacts = intelligence?.contacts ?? []
  const hasNamedContacts = contacts.some((contact) => contact.name.trim().length > 0)
  const hasEmail = contacts.some((contact) => contact.email?.trim())
  const hasPhone = contacts.some((contact) => contact.phone?.trim())
  const providerState = resolveProspectSearchContactProviderState(company)

  if (!hasNamedContacts) {
    const extracted = labels.some(
      (label) =>
        label.includes("website_public_extract") ||
        label.includes("growth.company_contacts") ||
        label.includes("contact_discovery"),
    )
    if (company.website?.trim() && !extracted) {
      return "website_extraction_pending"
    }
    if (providerState === "no_provider_connected" && company.source_type === "external_discovered") {
      return "contact_research_needed"
    }
    return "no_contacts_found"
  }

  if (hasEmail && hasPhone) return "phone_available"
  if (hasEmail) return "email_available"
  if (hasPhone) return "phone_available"

  const needsVerification = contacts.some(
    (contact) => !contact.email?.trim() && !contact.phone?.trim() && contact.name.trim().length > 0,
  )
  if (needsVerification) return "needs_verification"
  return "contacts_found"
}

export function formatProspectSearchContactCoverageLabel(
  status: ProspectSearchContactCoverageStatus,
): string {
  switch (status) {
    case "no_contacts_found":
      return "No contacts found"
    case "website_extraction_pending":
      return "Website extraction pending"
    case "contact_research_needed":
      return "Contact research needed"
    case "contacts_found":
      return "Contacts found"
    case "email_available":
      return "Email available"
    case "phone_available":
      return "Phone available"
    case "needs_verification":
      return "Needs verification"
    case "blocked_suppressed":
      return "Blocked / suppressed"
    default:
      return "Contact research needed"
  }
}

export function resolveProspectSearchContactFieldReason(input: {
  value: string | null | undefined
  company: GrowthProspectSearchCompanyResult
  channel: "email" | "phone"
}): string {
  const { company, channel, value } = input
  if (value?.trim()) return channel === "email" ? "Verified email on file" : "Phone on file"

  if (company.is_suppressed) return "Suppressed, do not contact"

  const providerState = resolveProspectSearchContactProviderState(company)
  if (providerState === "website_crawl" || company.website?.trim()) {
    return channel === "email"
      ? "No verified email on public website yet — run Find contacts"
      : "No phone on public website yet — run Find contacts"
  }
  if (providerState === "no_provider_connected" && company.source_type === "external_discovered") {
    return "Run Find contacts to extract public website contacts"
  }

  const intelligence = company.contact_intelligence
  if (!intelligence?.has_contacts) {
    return channel === "email"
      ? "No verified contacts yet — run Find contacts"
      : "Phone unavailable from current sources"
  }

  return channel === "email"
    ? "Email not found from current sources"
    : "Phone unavailable from current sources"
}

export function buildProspectSearchPeopleRowsFromCompanies(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const rows: GrowthProspectSearchPeopleResultRow[] = []

  for (const company of companies) {
    const intelligence = company.contact_intelligence
    const contacts = intelligence?.contacts ?? []
    for (const contact of contacts) {
      const name = contact.name?.trim()
      if (!name) continue

      const verification_status = resolveContactVerificationStatus(contact, company)
      const sourceEvidence = contact.source_evidence[0]
      const source_label = formatProspectSearchContactSourceLabel({
        source_label:
          contact.source_label ??
          (sourceEvidence
            ? formatWebsiteExtractEvidenceLabel({
                source_type: "website",
                source_evidence: [
                  {
                    claim: sourceEvidence.claim,
                    evidence: sourceEvidence.evidence,
                    source: sourceEvidence.source,
                    page_url: sourceEvidence.page_url ?? null,
                  },
                ],
              })
            : intelligence?.source_labels[0] ?? null),
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
      })
      const phone_on_dnc =
        typeof (contact as { phone_on_dnc?: unknown }).phone_on_dnc === "boolean"
          ? ((contact as { phone_on_dnc: boolean }).phone_on_dnc as boolean)
          : null
      const eligibility = resolveContactOutreachEligibilityBundle({
        email: contact.email,
        phone: contact.phone,
        verification_status,
        confidence: contact.confidence,
        company_suppressed: company.is_suppressed,
        contact_suppressed: company.is_suppressed,
        email_suppressed:
          typeof (contact as { email_suppressed?: unknown }).email_suppressed === "boolean"
            ? (contact as { email_suppressed: boolean }).email_suppressed
            : false,
        phone_on_dnc,
        last_checked_at: contact.last_checked_at ?? null,
        source_label,
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
      })
      const readiness = computeProspectSearchContactOutreachReadiness({
        email: contact.email,
        phone: contact.phone,
        verification_status,
        confidence: contact.confidence,
        suppressed: company.is_suppressed,
      })

      rows.push({
        id: `${company.source_type}:${company.id}:${contact.id}`,
        source_type: company.source_type,
        company_id: company.id,
        company_name: company.company_name,
        full_name: name,
        title: contact.title,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        role: contact.role_type,
        verification_status,
        rank_score: contact.confidence,
        company,
        contact_id: contact.id,
        email_reason: resolveProspectSearchContactFieldReason({
          value: contact.email,
          company,
          channel: "email",
        }),
        phone_reason: resolveProspectSearchContactFieldReason({
          value: contact.phone,
          company,
          channel: "phone",
        }),
        source_label,
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
        confidence: contact.confidence,
        location: company.location,
        compliance_status: readiness.compliance_status,
        last_checked_at: contact.last_checked_at ?? null,
        outreach_ready: eligibility.email.eligible || eligibility.call.eligible,
        email_available: readiness.email_available,
        phone_available: readiness.phone_available,
        call_ready: eligibility.call_ready,
        sms_ready: eligibility.sms_ready,
        readiness_label: eligibility.call.eligible
          ? "Call ready"
          : eligibility.email.eligible
            ? "Email outreach ready"
            : readiness.readiness_label,
        email_eligibility: eligibility.email.state,
        call_eligibility: eligibility.call.state,
        sms_eligibility: eligibility.sms.state,
        call_block_reason: eligibility.call_block_reason,
        sms_block_reason: eligibility.sms_block_reason,
        phone_on_dnc,
        timeline_events: buildProspectSearchPeopleTimelineEvents({
          contact,
          company,
          source_label,
        }),
      })
    }
  }

  return rows.sort((a, b) => b.rank_score - a.rank_score)
}

export function countProspectSearchPeopleRows(
  companies: GrowthProspectSearchCompanyResult[],
): number {
  return buildProspectSearchPeopleRowsFromCompanies(companies).length
}

export function resolveDefaultProspectSearchResultMode(input: {
  companies: GrowthProspectSearchCompanyResult[]
  filters: GrowthProspectSearchFilters
  serverPeopleCount?: number
}): ProspectSearchResultMode {
  const hydratedPeopleCount =
    countProspectSearchPeopleRows(input.companies) + (input.serverPeopleCount ?? 0)
  if (hydratedPeopleCount === 0) return "companies"
  if (hasProspectSearchDecisionMakerFilters(input.filters)) return "people"
  return "companies"
}

export function mergeProspectSearchPeopleResults(
  serverPeople: GrowthProspectSearchPersonResult[],
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const fromIntelligence = buildProspectSearchPeopleRowsFromCompanies(companies)
  const seen = new Set(fromIntelligence.map((row) => row.id))

  for (const person of serverPeople) {
    const company = companies.find((row) => row.id === person.company_id)
    if (!company) continue
    const rowId = `${person.source_type}:${person.company_id}:${person.id}`
    if (seen.has(rowId)) continue
    const eligibility = resolveContactOutreachEligibilityBundle({
      email: person.email,
      phone: person.phone,
      verification_status: "pending_verification",
      confidence: person.rank_score,
      company_suppressed: company.is_suppressed,
      contact_suppressed: company.is_suppressed,
      phone_on_dnc: null,
    })
    fromIntelligence.push({
      ...person,
      company,
      contact_id: person.id,
      email_reason: resolveProspectSearchContactFieldReason({
        value: person.email,
        company,
        channel: "email",
      }),
      phone_reason: resolveProspectSearchContactFieldReason({
        value: person.phone,
        company,
        channel: "phone",
      }),
      source_label: person.source_type,
      source_page_url: null,
      confidence: person.rank_score,
      location: company.location ?? null,
      compliance_status: company.is_suppressed ? "suppressed" : "review_required",
      last_checked_at: null,
      outreach_ready: eligibility.email.eligible || eligibility.call.eligible,
      email_available: Boolean(person.email?.trim()),
      phone_available: Boolean(person.phone?.trim()),
      call_ready: eligibility.call_ready,
      sms_ready: eligibility.sms_ready,
      readiness_label: company.is_suppressed ? "Suppressed for outreach" : "Needs verification",
      email_eligibility: eligibility.email.state,
      call_eligibility: eligibility.call.state,
      sms_eligibility: eligibility.sms.state,
      call_block_reason: eligibility.call_block_reason,
      sms_block_reason: eligibility.sms_block_reason,
      phone_on_dnc: null,
      timeline_events: [
        {
          id: "discovered-server",
          kind: "discovered",
          label: "Discovered",
          detail: "Server people index record",
          occurred_at: null,
        },
      ],
    })
    seen.add(rowId)
  }

  return fromIntelligence.sort((a, b) => b.rank_score - a.rank_score)
}

function buildProspectSearchPeopleTimelineEvents(input: {
  contact: GrowthProspectSearchContactIntelligence["contacts"][number]
  company: GrowthProspectSearchCompanyResult
  source_label: string | null
}): ProspectSearchPeopleTimelineEvent[] {
  const events: ProspectSearchPeopleTimelineEvent[] = [
    {
      id: "discovered",
      kind: "discovered",
      label: "Discovered",
      detail: input.source_label ?? "Evidence-backed contact discovered",
      occurred_at: input.contact.last_checked_at ?? null,
    },
  ]
  if (input.contact.verification_status?.includes("verified")) {
    events.push({
      id: "verified",
      kind: "verified",
      label: "Verified",
      detail: `Verification state: ${input.contact.verification_status.replace(/_/g, " ")}`,
      occurred_at: input.contact.last_checked_at ?? null,
    })
  }
  if (input.company.is_suppressed) {
    events.push({
      id: "suppressed",
      kind: "suppressed",
      label: "Suppressed",
      detail: input.company.suppression_reason ?? "Company suppressed for outreach",
      occurred_at: input.company.suppressed_at ?? null,
    })
  }
  return events
}

function resolveContactVerificationStatus(
  contact: GrowthProspectSearchContactIntelligence["contacts"][number],
  company: GrowthProspectSearchCompanyResult,
): string {
  if (company.is_suppressed) return "suppressed"
  if (contact.email?.trim() && contact.phone?.trim()) return "verified_channels"
  if (contact.email?.trim()) return "email_verified"
  if (contact.phone?.trim()) return "phone_verified"
  if (contact.name.trim()) return "pending_verification"
  return "not_found"
}

export function buildProspectSearchContactProviderMissingMessage(
  company: GrowthProspectSearchCompanyResult,
): string {
  const state = resolveProspectSearchContactProviderState(company)
  if (company.website?.trim()) {
    return "Run Find contacts to extract publicly listed names, emails, and phones from the company website."
  }
  if (state === "no_provider_connected") {
    return "No website on file — add a website or connect a paid contact provider for deeper research."
  }
  return "Contact research needed before outreach."
}

export function logProspectSearchContactDiscoveryIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}]`, code, context)
}
