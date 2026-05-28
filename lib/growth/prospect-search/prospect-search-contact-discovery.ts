/** Prospect Search contact discovery UX — coverage, people rows, provider honesty. Client-safe. */

import { formatWebsiteExtractEvidenceLabel } from "@/lib/growth/contact-discovery/website-extract-mapper"
import {
  resolveContactOutreachEligibilityBundle,
  type ProspectSearchContactEligibilityState,
} from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"
import { buildProspectSearchContactConfidenceReasoning } from "@/lib/growth/prospect-search/prospect-search-contact-confidence-reasoning"
import {
  resolveProspectSearchContactFreshness,
  resolveProspectSearchStaleWarning,
  GROWTH_CONTACT_FRESHNESS_QA_MARKER,
  type ProspectSearchContactFreshnessStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
import {
  classifyProspectSearchEmailVerificationDepth,
  classifyProspectSearchPhoneVerificationDepth,
  emailDepthImpliesVerified,
  phoneDepthImpliesCallable,
  type ProspectSearchEmailVerificationDepth,
  type ProspectSearchPhoneVerificationDepth,
} from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
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
export { GROWTH_CONTACT_FRESHNESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
export { GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"

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
  discovered_at: string | null
  last_verified_at: string | null
  source_last_seen_at: string | null
  verification_expires_at: string | null
  freshness_status: ProspectSearchContactFreshnessStatus
  email_verification_depth: ProspectSearchEmailVerificationDepth
  phone_verification_depth: ProspectSearchPhoneVerificationDepth
  confidence_label: string
  confidence_reason: string
  confidence_top_reasons: string[]
  confidence_risk_notes: string[]
  stale_warning: string | null
}

export type ProspectSearchPeopleTimelineEvent = {
  id: string
  kind:
    | "discovered"
    | "verified"
    | "refreshed"
    | "routed_queue"
    | "added_pipeline"
    | "suppressed"
    | "freshness"
    | "verification"
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

function buildPeopleContactProfile(input: {
  contact: GrowthProspectSearchContactIntelligence["contacts"][number]
  company: GrowthProspectSearchCompanyResult
  source_label: string | null
  source_page_url: string | null
  phone_on_dnc: boolean | null
  email_suppressed: boolean
}) {
  const { contact, company, source_label, source_page_url, phone_on_dnc, email_suppressed } = input
  const sourceEvidence = contact.source_evidence ?? []
  const meta = contact as {
    discovered_at?: string | null
    last_verified_at?: string | null
    source_last_seen_at?: string | null
    email_status?: string | null
    phone_status?: string | null
  }

  const freshness = resolveProspectSearchContactFreshness({
    discovered_at: meta.discovered_at ?? contact.last_checked_at ?? null,
    last_checked_at: contact.last_checked_at ?? null,
    last_verified_at: meta.last_verified_at ?? null,
    source_last_seen_at: meta.source_last_seen_at ?? contact.source_page_url ?? null,
  })

  const email_verification_depth = classifyProspectSearchEmailVerificationDepth({
    email: contact.email,
    source_label,
    source_page_url,
    source_evidence: sourceEvidence,
    email_status: meta.email_status ?? null,
  })
  const phone_verification_depth = classifyProspectSearchPhoneVerificationDepth({
    phone: contact.phone,
    source_label,
    source_page_url,
    source_evidence: sourceEvidence,
    phone_on_dnc,
    phone_status: meta.phone_status ?? null,
  })

  const verification_status = resolveContactVerificationStatus(contact, company, {
    email_verification_depth,
    phone_verification_depth,
  })

  const confidenceReasoning = buildProspectSearchContactConfidenceReasoning({
    confidence: contact.confidence,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    source_label,
    source_page_url,
    source_evidence_count: sourceEvidence.length,
    email_verification_depth,
    phone_verification_depth,
    freshness_status: freshness.freshness_status,
    company_match_confidence: company.company_match_confidence,
    company_suppressed: company.is_suppressed,
    phone_on_dnc,
  })

  const eligibility = resolveContactOutreachEligibilityBundle({
    email: contact.email,
    phone: contact.phone,
    verification_status,
    confidence: confidenceReasoning.confidence_score,
    company_suppressed: company.is_suppressed,
    contact_suppressed: company.is_suppressed,
    email_suppressed,
    phone_on_dnc,
    last_checked_at: freshness.last_checked_at,
    source_label,
    source_page_url,
    freshness_status: freshness.freshness_status,
    email_verification_depth,
    phone_verification_depth,
  })

  const readiness = computeProspectSearchContactOutreachReadiness({
    email: contact.email,
    phone: contact.phone,
    verification_status,
    confidence: confidenceReasoning.confidence_score,
    suppressed: company.is_suppressed,
  })

  const stale_warning = resolveProspectSearchStaleWarning({
    freshness_status: freshness.freshness_status,
    last_checked_at: freshness.last_checked_at,
    email: contact.email,
    phone: contact.phone,
    email_verification_depth,
    phone_verification_depth,
    email_eligibility: eligibility.email.state,
    call_eligibility: eligibility.call.state,
  })

  const email_reason = contact.email?.trim()
    ? formatEmailFieldReason(email_verification_depth)
    : resolveProspectSearchContactFieldReason({
        value: contact.email,
        company,
        channel: "email",
      })
  const phone_reason = contact.phone?.trim()
    ? formatPhoneFieldReason(phone_verification_depth, phone_on_dnc)
    : resolveProspectSearchContactFieldReason({
        value: contact.phone,
        company,
        channel: "phone",
      })

  return {
    freshness,
    email_verification_depth,
    phone_verification_depth,
    verification_status,
    confidenceReasoning,
    eligibility,
    readiness,
    stale_warning,
    email_reason,
    phone_reason,
  }
}

function formatEmailFieldReason(depth: ProspectSearchEmailVerificationDepth): string {
  switch (depth) {
    case "published_on_website":
      return "Published on company website"
    case "role_email":
      return "Role email discovered on website"
    case "personal_email":
      return "Personal-format email discovered"
    case "verification_needed":
      return "Email found but not verified"
    case "invalid_format":
      return "Invalid email format"
    case "disposable_domain":
      return "Disposable email domain detected"
    default:
      return "Email on file — verification pending"
  }
}

function formatPhoneFieldReason(
  depth: ProspectSearchPhoneVerificationDepth,
  phone_on_dnc: boolean | null,
): string {
  if (phone_on_dnc === true) return "DNC blocked — do not call"
  switch (depth) {
    case "published_on_website":
      return "Published on company website"
    case "mobile_possible":
      return "Mobile-capable phone on file"
    case "office_line":
      return "Office line on file"
    case "toll_free":
      return "Toll-free number on file"
    case "dispatch_line":
      return "Dispatch line on file"
    case "verification_needed":
      return "Phone found, call readiness pending"
    case "invalid_format":
      return "Invalid phone format"
    default:
      return "Phone on file"
  }
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
      const profile = buildPeopleContactProfile({
        contact,
        company,
        source_label,
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
        phone_on_dnc,
        email_suppressed:
          typeof (contact as { email_suppressed?: unknown }).email_suppressed === "boolean"
            ? (contact as { email_suppressed: boolean }).email_suppressed
            : false,
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
        verification_status: profile.verification_status,
        rank_score: profile.confidenceReasoning.confidence_score,
        company,
        contact_id: contact.id,
        email_reason: profile.email_reason,
        phone_reason: profile.phone_reason,
        source_label,
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
        confidence: profile.confidenceReasoning.confidence_score,
        location: company.location,
        compliance_status: profile.readiness.compliance_status,
        last_checked_at: profile.freshness.last_checked_at,
        outreach_ready: profile.eligibility.email.eligible || profile.eligibility.call.eligible,
        email_available: profile.readiness.email_available,
        phone_available: profile.readiness.phone_available,
        call_ready: profile.eligibility.call_ready,
        sms_ready: profile.eligibility.sms_ready,
        readiness_label: profile.stale_warning ?? (profile.eligibility.call.eligible
          ? "Call ready"
          : profile.eligibility.email.eligible
            ? "Email outreach ready"
            : profile.readiness.readiness_label),
        email_eligibility: profile.eligibility.email.state,
        call_eligibility: profile.eligibility.call.state,
        sms_eligibility: profile.eligibility.sms.state,
        call_block_reason: profile.eligibility.call_block_reason,
        sms_block_reason: profile.eligibility.sms_block_reason,
        phone_on_dnc,
        discovered_at: profile.freshness.discovered_at,
        last_verified_at: profile.freshness.last_verified_at,
        source_last_seen_at: profile.freshness.source_last_seen_at,
        verification_expires_at: profile.freshness.verification_expires_at,
        freshness_status: profile.freshness.freshness_status,
        email_verification_depth: profile.email_verification_depth,
        phone_verification_depth: profile.phone_verification_depth,
        confidence_label: profile.confidenceReasoning.confidence_label,
        confidence_reason: profile.confidenceReasoning.summary,
        confidence_top_reasons: profile.confidenceReasoning.top_reasons,
        confidence_risk_notes: profile.confidenceReasoning.risk_notes,
        stale_warning: profile.stale_warning,
        timeline_events: buildProspectSearchPeopleTimelineEvents({
          contact,
          company,
          source_label,
          freshness: profile.freshness,
          email_verification_depth: profile.email_verification_depth,
          phone_verification_depth: profile.phone_verification_depth,
          eligibility: profile.eligibility,
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
    const matchingContact = company.contact_intelligence?.contacts.find(
      (c) => c.id === person.id || c.name === person.full_name,
    )
    if (matchingContact) {
      const built = buildProspectSearchPeopleRowsFromCompanies([company]).find((r) => r.id === rowId)
      if (built) {
        fromIntelligence.push(built)
        seen.add(rowId)
        continue
      }
    }
    const freshness = resolveProspectSearchContactFreshness({})
    const email_verification_depth = classifyProspectSearchEmailVerificationDepth({
      email: person.email,
    })
    const phone_verification_depth = classifyProspectSearchPhoneVerificationDepth({
      phone: person.phone,
    })
    const eligibility = resolveContactOutreachEligibilityBundle({
      email: person.email,
      phone: person.phone,
      verification_status: "pending_verification",
      confidence: person.rank_score,
      company_suppressed: company.is_suppressed,
      contact_suppressed: company.is_suppressed,
      phone_on_dnc: null,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
    })
    const confidenceReasoning = buildProspectSearchContactConfidenceReasoning({
      confidence: person.rank_score,
      email: person.email,
      phone: person.phone,
      title: person.title,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
      company_suppressed: company.is_suppressed,
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
      confidence: confidenceReasoning.confidence_score,
      location: company.location ?? null,
      compliance_status: company.is_suppressed ? "suppressed" : "review_required",
      last_checked_at: null,
      outreach_ready: eligibility.email.eligible || eligibility.call.eligible,
      email_available: Boolean(person.email?.trim()),
      phone_available: Boolean(person.phone?.trim()),
      call_ready: eligibility.call_ready,
      sms_ready: eligibility.sms_ready,
      readiness_label: resolveProspectSearchStaleWarning({
        freshness_status: freshness.freshness_status,
        email: person.email,
        phone: person.phone,
        email_verification_depth,
        phone_verification_depth,
        call_eligibility: eligibility.call.state,
      }) ?? (company.is_suppressed ? "Suppressed for outreach" : "Needs verification"),
      email_eligibility: eligibility.email.state,
      call_eligibility: eligibility.call.state,
      sms_eligibility: eligibility.sms.state,
      call_block_reason: eligibility.call_block_reason,
      sms_block_reason: eligibility.sms_block_reason,
      phone_on_dnc: null,
      discovered_at: null,
      last_verified_at: null,
      source_last_seen_at: null,
      verification_expires_at: null,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
      confidence_label: confidenceReasoning.confidence_label,
      confidence_reason: confidenceReasoning.summary,
      confidence_top_reasons: confidenceReasoning.top_reasons,
      confidence_risk_notes: confidenceReasoning.risk_notes,
      stale_warning: resolveProspectSearchStaleWarning({
        freshness_status: freshness.freshness_status,
        email: person.email,
        phone: person.phone,
        email_verification_depth,
        phone_verification_depth,
        call_eligibility: eligibility.call.state,
      }),
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
  freshness?: ReturnType<typeof resolveProspectSearchContactFreshness>
  email_verification_depth?: ProspectSearchEmailVerificationDepth
  phone_verification_depth?: ProspectSearchPhoneVerificationDepth
  eligibility?: ReturnType<typeof resolveContactOutreachEligibilityBundle>
}): ProspectSearchPeopleTimelineEvent[] {
  const events: ProspectSearchPeopleTimelineEvent[] = [
    {
      id: "discovered",
      kind: "discovered",
      label: "Discovered",
      detail: input.source_label ?? "Evidence-backed contact discovered",
      occurred_at: input.freshness?.discovered_at ?? input.contact.last_checked_at ?? null,
    },
  ]
  if (input.email_verification_depth || input.phone_verification_depth) {
    events.push({
      id: "verification",
      kind: "verification",
      label: "Verification",
      detail: [
        input.email_verification_depth
          ? `Email: ${input.email_verification_depth.replace(/_/g, " ")}`
          : null,
        input.phone_verification_depth
          ? `Phone: ${input.phone_verification_depth.replace(/_/g, " ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      occurred_at: input.freshness?.last_verified_at ?? input.contact.last_checked_at ?? null,
    })
  }
  if (input.contact.verification_status?.includes("verified")) {
    events.push({
      id: "verified",
      kind: "verified",
      label: "Verified",
      detail: `Verification state: ${input.contact.verification_status.replace(/_/g, " ")}`,
      occurred_at: input.freshness?.last_verified_at ?? input.contact.last_checked_at ?? null,
    })
  }
  if (input.freshness) {
    events.push({
      id: "freshness",
      kind: "freshness",
      label: "Freshness",
      detail: `Status: ${input.freshness.freshness_status.replace(/_/g, " ")}${
        input.freshness.last_checked_at
          ? ` · last checked ${new Date(input.freshness.last_checked_at).toLocaleDateString()}`
          : ""
      }`,
      occurred_at: input.freshness.last_checked_at,
    })
  }
  if (input.eligibility) {
    events.push({
      id: "eligibility",
      kind: "verification",
      label: "Eligibility snapshot",
      detail: `Email ${input.eligibility.email.state} · Call ${input.eligibility.call.state} · SMS ${input.eligibility.sms.state}`,
      occurred_at: input.freshness?.last_checked_at ?? null,
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
  depths?: {
    email_verification_depth: ProspectSearchEmailVerificationDepth
    phone_verification_depth: ProspectSearchPhoneVerificationDepth
  },
): string {
  if (company.is_suppressed) return "suppressed"
  if (depths) {
    const emailOk = emailDepthImpliesVerified(depths.email_verification_depth)
    const phoneOk = phoneDepthImpliesCallable(depths.phone_verification_depth)
    if (emailOk && phoneOk) return "verified_channels"
    if (emailOk) return "email_verified"
    if (phoneOk) return "phone_verified"
    if (depths.email_verification_depth === "verification_needed") return "pending_verification"
    if (depths.phone_verification_depth === "verification_needed") return "pending_verification"
  }
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

export function logProspectSearchContactRefresh(input: {
  userId?: string | null
  scope: "selected" | "visible" | "stale" | "company"
  count: number
  company_ids?: string[]
}): void {
  console.info(
    JSON.stringify({
      source: "growth-prospect-search",
      event: "contact_refresh",
      qa_marker: GROWTH_CONTACT_FRESHNESS_QA_MARKER,
      ts: new Date().toISOString(),
      user_id: input.userId ?? null,
      scope: input.scope,
      count: input.count,
      company_ids: input.company_ids ?? [],
    }),
  )
}

export function appendProspectSearchPeopleRefreshEvent(
  row: Pick<GrowthProspectSearchPeopleResultRow, "timeline_events">,
): ProspectSearchPeopleTimelineEvent[] {
  return [
    ...row.timeline_events,
    {
      id: `refreshed-${Date.now()}`,
      kind: "refreshed",
      label: "Refresh requested",
      detail: "Operator triggered verification refresh — internal providers will rerun",
      occurred_at: new Date().toISOString(),
    },
  ]
}

export function logProspectSearchContactDiscoveryIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}]`, code, context)
}
